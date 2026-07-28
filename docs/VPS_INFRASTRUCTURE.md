# VPS Infrastructure — Everything Outside Version Control

This document exists because several pieces of production infrastructure live
**only on the VPS itself**, not in this git repository. If the server is ever
rebuilt, migrated, or replaced, `git clone` + `docker compose up` alone will
**not** reproduce a working system — the pieces below have to be recreated by
hand, using this document.

Server: `187.127.176.149` (root SSH). Repo checked out at `/opt/crediiflow`.
Deploys via `.github/workflows/deploy.yml` (`git pull` + `docker compose up -d
--build` over SSH on every push to `main`).

Last verified against the live server: 2026-07-28.

---

## 0. The real reverse proxy is HOST-level nginx, not the docker-compose `nginx` service

**Discovered 2026-07-23, after it silently failed on every deploy for a
while and briefly took the site down when something tried to actually free
port 80/443 for it.** This VPS also hosts an unrelated site, `worrkin.in` —
that's the reason a HOST-level `nginx.service` exists at all here, with its
own config at `/etc/nginx/sites-enabled/crediiflow.conf` (crediiflow domains,
`proxy_pass` to `127.0.0.1:3000/3001/3002/8000`, the same ports this stack's
containers publish) and `/etc/nginx/sites-enabled/worrkin.conf`. That host
nginx is the **actual production reverse proxy** for crediiflow.in today.

```
Internet
   │
   ▼
HOST nginx.service  (systemd, port 80/443, /etc/nginx/sites-enabled/*.conf)
   │
   ├─ crediiflow.conf ──▶ 127.0.0.1:3000  (crediiflow_frontend container)
   │                  ──▶ 127.0.0.1:3001  (crediiflow_superadmin_frontend)
   │                  ──▶ 127.0.0.1:3002  (crediiflow_landing_page)
   │                  ──▶ 127.0.0.1:8000  (crediiflow_backend)
   │
   └─ worrkin.conf    ──▶ 127.0.0.1:8080  (unrelated app, not in this repo)

docker-compose.yml's `nginx` service (crediiflow_nginx container, port
80/443) is DISABLED -- it would fight the host nginx for the same ports.
```

The `nginx` service in `docker-compose.yml` is now **commented out**. Left
enabled, it competed for the exact same ports as the host nginx: it either
lost the race silently (container runs, but `docker port` shows no bound
ports — traffic still worked because the host nginx already had 80/443) or,
if the host nginx was ever stopped first, it took the whole site (and
worrkin.in) down until the host nginx was manually restored. **Do not
re-enable the docker-compose `nginx` service without first decommissioning
the host-level one** (or vice versa) — never run both.

**Incident record (2026-07-23, ~12:13–12:17 UTC):** while diagnosing this,
the host nginx got stopped to test the port-conflict theory, which took down
crediiflow.in *and* worrkin.in for real (not the docker container — it
never actually held the port). Confirmed from `journalctl -u nginx`:
`Stopped` 12:13:27 UTC, `Started` 12:17:19 UTC — **3m52s**. The restart at
12:17:19 was a human (SSH session from `122.161.53.180`, connected and ran
one command in the same second), not this fix — that session then
immediately used worrkin.in's admin login (visible in
`/var/log/nginx/access.log`), two failed attempts. No crediiflow.in traffic
is logged in the gap (silence isn't proof of zero impact — nginx wasn't
running to log failed connection attempts either way). Root cause (the
docker-compose service definition + the certbot hooks pointing at it) fixed
and deployed the same session; the next deploy (`548a80e`) succeeded cleanly
in GitHub Actions where the prior ones had been silently failing on this
exact conflict.

Practical implications:
- `systemctl status nginx` / `systemctl restart nginx` (not `docker
  restart crediiflow_nginx`) is how you actually manage the reverse proxy now.
- The SSL renewal hooks (§1 below) and `ssl-trigger-watcher.sh` were
  originally written against the docker container and have been corrected to
  `systemctl stop/start nginx`.
- If nginx config ever needs changing, edit
  `/etc/nginx/sites-enabled/crediiflow.conf` directly on the host — this file
  is **not** in git (same "lives only on the VPS" caveat as everything else
  in this document) and `nginx.conf`/`docker-compose.yml`'s (disabled)
  `nginx` service in the repo no longer reflect reality.

---

## 1. SSL automation for new tenant subdomains

### The problem this solves

The app's cert (`api.crediiflow.in`) is a single Let's Encrypt certificate
covering multiple SANs (subject alternative names) — one per tenant subdomain
— rather than a wildcard. Every time a new tenant is onboarded via the
superadmin panel, its subdomain needs to be **added** to that cert's SAN list,
which is a `certbot certonly --expand` operation, not a plain `certbot renew`
(renew only re-issues for domains *already* on the cert; it can't add a new
one). `backend/app/routers/super_admin.py`'s `create_tenant()` and the
superadmin "Renew SSL" button both just drop a trigger file at
`/app/triggers/ssl_renew.trigger` (mapped via docker-compose to
`/opt/crediiflow/triggers/ssl_renew.trigger` on the host) — everything that
actually *acts* on that file lives on the VPS, described below.

### Directory permission requirement

`/opt/crediiflow/triggers` **must be owned `1002:1001`** (the backend
container's `appuser:appgroup` — see `backend/Dockerfile`'s `USER appuser`).
The backend container runs as this non-root user deliberately (hardening), so
if the host directory is `root:root` the trigger file write fails silently
with `PermissionError` (non-fatal for tenant creation — logged and swallowed
— but SSL never gets provisioned).

```bash
chown 1002:1001 /opt/crediiflow/triggers
chmod 755 /opt/crediiflow/triggers
```

### The watcher script

`/opt/crediiflow/ssl-trigger-watcher.sh` (owner `root:root`, mode `755`):

```bash
#!/bin/bash
# CrediiFlow SSL trigger watcher.
#
# Polled every minute by crediiflow-ssl-watcher.timer (systemd). When the
# backend writes /opt/crediiflow/triggers/ssl_renew.trigger (on new tenant
# creation, or via the superadmin "Renew SSL" button), this script expands
# the api.crediiflow.in cert to cover every active tenant subdomain, then
# consumes (deletes) the trigger file so it isn't reprocessed.
#
# This is bespoke infra glue living OUTSIDE the git repo, on the VPS itself
# at /opt/crediiflow/ssl-trigger-watcher.sh. If this server is ever rebuilt
# or migrated, this file (and the two systemd units that schedule it) need
# to be recreated manually -- nothing in version control does this.
set -uo pipefail

TRIGGER_FILE="/opt/crediiflow/triggers/ssl_renew.trigger"
LOG_FILE="/var/log/crediiflow-ssl-watcher.log"
CERT_NAME="api.crediiflow.in"
ROOT_DOMAIN="crediiflow.in"
BASE_DOMAINS=(
  "api.${ROOT_DOMAIN}"
  "app.${ROOT_DOMAIN}"
  "${ROOT_DOMAIN}"
  "www.${ROOT_DOMAIN}"
  "superadmin.${ROOT_DOMAIN}"
)

log() {
  echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') $1" >> "$LOG_FILE"
}

if [ ! -f "$TRIGGER_FILE" ]; then
  exit 0
fi

log "=== Trigger detected, processing ==="

TENANT_SUBDOMAINS=$(docker exec crediiflow_db psql -U doit_admin -d crediiflow_master -tAc \
  "SELECT subdomain FROM tenants WHERE status='active';" 2>>"$LOG_FILE")

if [ $? -ne 0 ]; then
  log "FAILED to query tenant subdomains from master DB -- aborting this run, trigger file kept for retry."
  exit 1
fi

DOMAIN_ARGS=()
for d in "${BASE_DOMAINS[@]}"; do
  DOMAIN_ARGS+=("-d" "$d")
done
while IFS= read -r sub; do
  sub=$(echo "$sub" | tr -d '[:space:]')
  [ -z "$sub" ] && continue
  DOMAIN_ARGS+=("-d" "${sub}.${ROOT_DOMAIN}")
done <<< "$TENANT_SUBDOMAINS"

log "Domain list for this run: ${DOMAIN_ARGS[*]}"

# The existing cert's authenticator is --standalone (binds its own listener on
# port 80 to complete the HTTP-01 challenge), which conflicts with the
# reverse proxy already holding that port -- the HOST-level nginx.service
# (not the docker-compose 'nginx' service, which is disabled -- see §0).
# Stop it for the duration of the certbot call, then always restart it
# regardless of outcome.
log "Stopping nginx to free port 80..."
systemctl stop nginx >>"$LOG_FILE" 2>&1

certbot certonly --standalone --cert-name "$CERT_NAME" --expand \
  "${DOMAIN_ARGS[@]}" \
  --non-interactive --agree-tos --no-eff-email \
  -m admin@xcplllp.com >>"$LOG_FILE" 2>&1
CERTBOT_EXIT=$?

log "Restarting nginx..."
systemctl start nginx >>"$LOG_FILE" 2>&1

if [ $CERTBOT_EXIT -eq 0 ]; then
  log "Certbot succeeded -- cert now covers: ${DOMAIN_ARGS[*]}"
else
  log "Certbot FAILED (exit $CERTBOT_EXIT) -- see certbot output above. Consuming trigger anyway per policy; use the superadmin Renew SSL button to retry, or re-run this script manually after investigating."
fi

rm -f "$TRIGGER_FILE"
log "=== Trigger consumed, run complete ==="
```

Watcher log lives at `/var/log/crediiflow-ssl-watcher.log` (plain text,
append-only — not currently log-rotated; worth adding a logrotate entry if it
grows large over time).

### Systemd units

`/etc/systemd/system/crediiflow-ssl-watcher.service`:

```ini
[Unit]
Description=CrediiFlow: process pending SSL trigger file (expand cert for new tenant subdomains)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/crediiflow/ssl-trigger-watcher.sh
```

`/etc/systemd/system/crediiflow-ssl-watcher.timer`:

```ini
[Unit]
Description=Run crediiflow-ssl-watcher.service every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=10s
Persistent=false

[Install]
WantedBy=timers.target
```

Enable after creating both files:

```bash
systemctl daemon-reload
systemctl enable --now crediiflow-ssl-watcher.timer
```

Verify it's running: `systemctl status crediiflow-ssl-watcher.timer`.

### Certbot renewal hooks (fixes the *existing* twice-daily renewal too)

The stock OS-installed `certbot.timer` / `/etc/cron.d/certbot` (ships with the
`certbot` apt package, unrelated to this app) runs `certbot renew` twice
daily. The cert's renewal config (`/etc/letsencrypt/renewal/api.crediiflow.in.conf`)
uses `authenticator = standalone`, which has the *same* port-80 conflict with
the reverse proxy as above. This had never actually triggered a failure only
because the cert wasn't yet within its 30-day renewal window — but it would
have failed the first time renewal actually ran. Fixed with two hook scripts
(certbot runs anything executable in these directories automatically around a
real renewal):

`/etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh` (mode `755`):

```bash
#!/bin/bash
# Standalone authenticator needs port 80 free. The reverse proxy is the
# HOST-level nginx.service -- see §0 -- not the docker-compose 'nginx'
# service, which is disabled.
systemctl stop nginx
```

`/etc/letsencrypt/renewal-hooks/post/start-nginx.sh` (mode `755`):

```bash
#!/bin/bash
systemctl start nginx
```

### Current cert status (as of last verification)

```
Certificate Name: api.crediiflow.in
Domains: api.crediiflow.in app.crediiflow.in crediiflow.in do-it-services.crediiflow.in suji.crediiflow.in superadmin.crediiflow.in www.crediiflow.in
Authenticator: standalone
Key type: ECDSA
```

### Incident: nginx was serving a different, stale cert (2026-07-28)

**The watcher above was never broken.** Every tenant onboarding correctly
ran `certbot certonly --expand --cert-name api.crediiflow.in`, so
`/etc/letsencrypt/live/api.crediiflow.in/` always had an up-to-date SAN list.
The bug was in `/etc/nginx/sites-enabled/crediiflow.conf`: all four HTTPS
`server` blocks (`crediiflow.in`/`www`, the `*.crediiflow.in` wildcard app
block, `superadmin.crediiflow.in`, `api.crediiflow.in`) had `ssl_certificate`
pointed at `/etc/letsencrypt/live/crediiflow.in/` instead —  a **second,
separate** cert that predates the watcher automation and is never touched by
it. That cert's SAN list still had a leftover `aayir.crediiflow.in` from
whenever it was last issued by hand, and had never picked up newer tenant
subdomains (`suji.crediiflow.in` at the time this was caught) — so any tenant
onboarded after that manual cert existed got a certificate name-mismatch
warning in the browser, even though a perfectly valid cert covering them
already existed on disk, unused.

Fixed by repointing all four `ssl_certificate`/`ssl_certificate_key` lines in
`crediiflow.conf` from `live/crediiflow.in/` to `live/api.crediiflow.in/`,
then `nginx -t && systemctl reload nginx`. This is the actual permanent
fix — nginx now serves the one cert the watcher automation keeps in sync, so
every future tenant onboarding (which already correctly triggers the
watcher) will "just work" without ever needing this repointing again.

**If a stray `crediiflow.conf.bak-*` file ever ends up back in
`/etc/nginx/sites-enabled/`, remove or move it out before running `nginx
-t`** — `nginx.conf`'s `include /etc/nginx/sites-enabled/*;` is a wildcard
and will load it too, producing a wall of "conflicting server name...
ignored" warnings from the duplicate server blocks (harmless to the running
config, but confusing, and a sign the backup wasn't moved out properly).

The orphaned `crediiflow.in` cert (`/etc/letsencrypt/live/crediiflow.in/`)
is now unused by anything but was left in place rather than deleted —
harmless as dead weight, and deleting a live cert on a whim is not worth the
risk for the disk space it saves.

---

## 2. Docker Compose — external volumes that must exist before first `up`

`docker-compose.yml` declares two volumes as `external: true`, meaning Compose
will **refuse to start** unless they already exist — they are not
auto-created. On a fresh server, create them first:

```bash
docker volume create do-it-services_postgres_data
docker volume create do-it-services_certbot_www
```

(Names must match exactly — they're hardcoded in `docker-compose.yml`'s
`volumes:` block as `do-it-services_postgres_data` and
`do-it-services_certbot_www`.)

---

## 3. `.env` file — `/opt/crediiflow/.env`

Not in git (gitignored, as it should be). Keys currently in use, values held
only on the server:

```
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
DATABASE_URL=
DB_HOST=
DB_PASSWORD=
DB_PORT=
DB_USER=
JWT_SECRET_KEY=
MASTER_DATABASE_URL=
PORT=
POSTGRES_DB=
POSTGRES_PASSWORD=
POSTGRES_USER=
```

`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` back the auto-DNS-record
creation in `cloudflare_add_dns()` (`super_admin.py`) — without them, new
tenant DNS records silently don't get created (that function no-ops with a
log line if either is unset, by design).

`CF_ROOT_DOMAIN` and `VPS_IP` are **not** in `.env` — the code falls back to
hardcoded defaults (`crediiflow.in` and `187.127.176.149` respectively) when
those env vars are absent, which is the current state.

---

## 4. Nginx config — `/opt/crediiflow/nginx.conf` (VESTIGIAL as of 2026-07-23, see §0)

Was mounted read-only into the `crediiflow_nginx` container
(`./nginx.conf:/etc/nginx/nginx.conf:ro` per `docker-compose.yml`), which is
now disabled — this file is no longer part of the live routing path. The
**real** live nginx config is `/etc/nginx/sites-enabled/crediiflow.conf` on
the host (also not in git — same "server-only" caveat, just a different
file). This file is **not** in git either — it's hand-maintained directly on
the server. Two backup copies exist alongside it from manual edits on
2026-07-08 (`nginx.conf.bak.20260708070807`, `nginx.conf.bak.20260708072025`)
— evidence someone was editing it by hand that day; no changelog beyond the
timestamps.

If nginx routing/rate-limiting/proxy rules are ever debugged or changed, edit
`/etc/nginx/sites-enabled/crediiflow.conf`, not this file — and remember the
live config is server-only either way; consider bringing it into the repo
(even as a reference copy) in a future pass so changes are diffable.

---

## 5. Database backup — wired up and running daily; R2 destination still pending

**Status as of 2026-07-20: the backup mechanism (dump → compress → encrypt)
is installed, scheduled, and verified working end-to-end. The final upload
leg (Cloudflare R2) is intentionally not yet configured — real R2 credentials
haven't been provisioned. Until they are, the job runs daily, correctly
detects that R2 isn't configured, and exits cleanly with no partial/silent
failure — it does not pretend to succeed.**

### What changed from the original script

`backend/backup_postgres_r2.sh` originally ran `pg_dump -d $POSTGRES_DB`
(single database). This is a DB-per-tenant architecture — `POSTGRES_DB`
(`doit_production`) is just the container's empty default bootstrap
database; the real data lives in `crediiflow_master` (tenant registry) and
one `crediiflow_<subdomain>` database per tenant. The original script would
have backed up nothing that mattered. Fixed to use `pg_dumpall`, which dumps
every database in the cluster (plus roles/globals) in one pass and
automatically picks up new tenants without code changes.

Also removed the script's curl-based "fallback" upload path. R2 requires
AWS SigV4-signed requests; an unsigned `curl PUT` was never a working
alternative to the `aws` CLI — it would be rejected by any real private
bucket, or (worse) print a false "✅ success" without uploading anything. The
script now fails loudly if `aws` isn't installed instead of silently no-op'ing
through it.

### Where it runs, and why

Unlike `ssl-trigger-watcher.sh` (which runs `docker exec` into the backend
container), the backup runs **directly on the host**, not inside a container:
there's no cron daemon in the backend image, and installing one would only
last until the next `docker compose up --build` (rebuilt on every deploy)
wiped it out. Running from the host via systemd is deploy-proof.

This means the backup uses the Postgres port already published to the host's
loopback interface (`docker-compose.yml`: `"127.0.0.1:5432:5432"` on the `db`
service) rather than the container-internal hostname `db`. `postgresql-client`
(for `pg_dumpall`) and `awscli` (for the eventual R2 upload, via `pip install
--break-system-packages awscli` since the `awscli` apt package isn't available
on this box's configured repos) were installed directly on the host for this.

### `.env` additions (`/opt/crediiflow/.env`)

```
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
DB_BACKUP_KEY=<a generated random key -- already set on the live server, not reproduced here>

# PENDING: fill these in with real Cloudflare R2 values
R2_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_BACKUP_BUCKET=doit-db-backups
AWS_ACCESS_KEY_ID=PENDING_R2_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=PENDING_R2_SECRET_ACCESS_KEY
```

`DB_BACKUP_KEY` is the AES-256 passphrase the script encrypts every dump
with — generate a new one with `openssl rand -base64 48` if this ever needs
to be recreated (but note: doing so makes any *previously* encrypted backup
undecryptable with the new key — keep old keys alongside old backups, don't
just overwrite).

`R2_S3_ENDPOINT` is deliberately left at the exact placeholder string the
script itself checks for (`https://your-account-id.r2.cloudflarestorage.com`)
— this is what makes the script's own validation guard trip cleanly with a
clear error, rather than attempting a doomed request against a fake host.

**To finish this setup**: in the Cloudflare dashboard, create an R2 bucket,
then R2 → Manage API Tokens → create a token scoped to Object Read & Write on
that bucket. Replace the four `R2_*`/`AWS_*` placeholder lines above with the
real bucket name, endpoint (shown on the R2 dashboard, format
`https://<account-id>.r2.cloudflarestorage.com`), and the token's Access Key
ID / Secret Access Key. No script or systemd changes needed after that — the
next scheduled run (or a manual `systemctl start crediiflow-db-backup.service`)
will pick the new values up automatically.

### Systemd units

`/etc/systemd/system/crediiflow-db-backup.service`:

```ini
[Unit]
Description=CrediiFlow: encrypted Postgres cluster backup to Cloudflare R2
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
EnvironmentFile=/opt/crediiflow/.env
ExecStart=/opt/crediiflow/backend/backup_postgres_r2.sh
```

`/etc/systemd/system/crediiflow-db-backup.timer`:

```ini
[Unit]
Description=Run crediiflow-db-backup.service daily at 02:00 UTC

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

`Persistent=true` means if the VPS is down at 02:00 (reboot, maintenance),
the backup runs shortly after boot instead of being silently skipped until
the next day — deliberately more cautious than the SSL watcher's timer, since
missing a whole day of backups is worse than missing one SSL-trigger poll.

Enable after creating both files: `systemctl daemon-reload && systemctl
enable --now crediiflow-db-backup.timer`. Check status with `systemctl
list-timers crediiflow-db-backup.timer` or `journalctl -u
crediiflow-db-backup.service`.

**Also note**: `backend/backup_postgres_r2.sh` must be executable
(`chmod 755`) — it was previously committed as `100644` in git, which made
the systemd service fail with `203/EXEC` the first time it was invoked
directly (rather than via `bash script.sh`). Fixed in git with `git
update-index --chmod=+x`, so a fresh clone now gets the right mode.

### What was actually tested (2026-07-20)

- `systemctl start crediiflow-db-backup.service` → correctly fails with
  `❌ Error: R2_S3_ENDPOINT is not configured or is set to a placeholder.`
  (exit 1, no partial upload attempt, no silent success) — confirms the
  guard rail works exactly as intended given the current pending state.
- Ran the dump → gzip → encrypt → decrypt → gunzip round-trip manually
  (bypassing only the R2 step, which can't be tested without real
  credentials): produced a 128KB encrypted archive containing all 3
  databases (`crediiflow_master`, `crediiflow_do_it_services`,
  `doit_production`) and 45 `COPY` statements (i.e. actual row data, not
  just schema) — confirms the backup content itself is real, complete, and
  restorable, independent of the still-pending R2 destination.

### Known pre-existing gap this replaces

A stray one-off dump, `/opt/crediiflow/my_database_backup.sql` (created
2026-06-08, ~325KB), still sits in the deploy directory root — almost
certainly a manual `pg_dump` someone ran once before any of the above
existed. Harmless to leave, safe to delete once the R2 pipeline above is
confirmed working with real credentials and has produced its first real
off-server backup.

---

## 6. Connection pool settings (documented in code, restated here for visibility)

From `backend/app/database/db.py`:

- **Master DB** (`crediiflow_master`): `pool_size=5, max_overflow=10, pool_pre_ping=True`.
- **Per-tenant DB**: `pool_size=3, max_overflow=5, pool_pre_ping=True`. Engines
  are cached forever once a tenant is first accessed in a given backend
  process lifetime (no idle eviction) — so `pool_size` is really a *floor* on
  live Postgres connections per ever-accessed tenant, not a ceiling. At
  `pool_size=3` this comfortably supports 50-100+ tenants against Postgres's
  `max_connections=400` (set via `docker-compose.yml`'s `command:` on the
  `db` service — also not overridable via `.env`, it's hardcoded in the
  compose file). Revisit alongside PgBouncer or idle-eviction before tenant
  count grows enough to matter.

---

## 7. Other host-level cron/timer jobs (stock OS / unrelated to this app)

For completeness, everything else scheduled on the host as of this writing —
none of this is CrediiFlow-specific, no action needed, listed so a future
audit doesn't have to rediscover it:

| Schedule | Job | Source |
|---|---|---|
| Every 12h | `certbot renew` | stock `certbot` apt package (`/etc/cron.d/certbot`) |
| Daily 04:46 | `docker image prune -af --filter until=24h` | `/etc/cron.d/docker-image-prune` — keeps disk usage down |
| Weekly Sun 03:30 + daily 03:10 | `e2scrub_all` (filesystem check) | stock Ubuntu (`/etc/cron.d/e2scrub_all`) |
| Weekly Wed 21:17 | `monarx-agent`/`monarx-protect` update | third-party security/malware monitoring agent, pre-existing on this VPS, unrelated to CrediiFlow |
| Every 10min + daily 23:59 | `sysstat` data collection | stock Ubuntu (`/etc/cron.d/sysstat`) |

`ufw` (host firewall) is **inactive** — there is no host-level firewall
management beyond Docker's own port publishing and Cloudflare's proxy/WAF in
front of it.

---

## 8. Quick reference — full disaster-recovery checklist

If this VPS is ever rebuilt from scratch:

1. Install Docker, Docker Compose, Certbot (`apt install certbot`).
2. `docker volume create do-it-services_postgres_data` and
   `docker volume create do-it-services_certbot_www` (§2).
3. `git clone` this repo to `/opt/crediiflow`.
4. Recreate `/opt/crediiflow/.env` with the keys listed in §3 (values from
   secrets manager / password vault — not in this doc, not in git).
5. Install nginx on the host (`apt install nginx`) and recreate
   `/etc/nginx/sites-enabled/crediiflow.conf` (§0 — not in git; check for an
   off-server backup) plus `sites-enabled/worrkin.conf` if worrkin.in is
   still meant to live on this same VPS. `systemctl enable --now nginx`. The
   in-repo `nginx.conf` / docker-compose `nginx` service (§4) are vestigial —
   don't rely on them; the disabled service in `docker-compose.yml` should
   stay commented out unless the host nginx is being decommissioned instead.
6. Issue the initial cert manually (first issuance, before the watcher has
   anything to expand): `certbot certonly --standalone --cert-name
   api.crediiflow.in -d api.crediiflow.in -d app.crediiflow.in -d
   crediiflow.in -d www.crediiflow.in -d superadmin.crediiflow.in -d
   <each existing tenant subdomain>.crediiflow.in ...` (`systemctl stop
   nginx` first to free port 80, per §0/§1).
7. `chown 1002:1001 /opt/crediiflow/triggers; chmod 755 /opt/crediiflow/triggers` (§1).
8. Recreate `/opt/crediiflow/ssl-trigger-watcher.sh` from §1's inline copy,
   `chmod 755`.
9. Recreate the two systemd units from §1, `daemon-reload`, `enable --now`
   the timer.
10. Recreate the two certbot renewal hooks from §1, `chmod 755` both.
11. `docker compose up -d --build`.
12. Set up GitHub Actions secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`) for
    `.github/workflows/deploy.yml` to keep working.
13. Install `postgresql-client` (`apt install postgresql-client`) and `awscli`
    (`pip install --break-system-packages awscli`) on the host (§5).
14. Add the backup-related `.env` keys from §5 (`POSTGRES_HOST`,
    `POSTGRES_PORT`, `DB_BACKUP_KEY`, and the real `R2_*`/`AWS_*` values —
    not the placeholders — if R2 was ever actually configured before the
    disaster; otherwise re-provision R2 fresh per §5's setup steps).
15. `chmod 755` on `/opt/crediiflow/backend/backup_postgres_r2.sh` if it
    isn't already (should be `100755` in git — verify with `git ls-files -s`).
16. Recreate the two backup systemd units from §5, `daemon-reload`,
    `enable --now` the timer.

**Important caveat**: if R2 was never actually configured with real
credentials before a hypothetical total server loss, there is **no off-server
copy of the database to restore from** — the `postgres_data` Docker volume
recreated in step 2 starts empty, and this whole checklist rebuilds the
*application*, not the *data*. Confirming R2 is actually receiving real
backups (§5) is what makes this checklist meaningful for data recovery, not
just service recovery. Until then, the only backup is whatever the VPS
provider's own infrastructure-level disk snapshots (if any) provide —
verify that separately; it isn't covered by anything in this document.

---

## 9. Outbound email (tenant onboarding) — code is real, SMTP credentials still pending

**Status: the send path (`backend/app/logic/email.py`) is fully implemented
and wired into `POST /superadmin/tenants` — not a simulation. With no SMTP
env vars set (the case on production today), it detects that cleanly, logs a
one-line skip notice, and returns `False` without ever failing tenant
creation itself.** Same "real code, pending credentials" shape as §5's R2
upload leg.

### What it does

When a superadmin fills in the optional "Admin Email" field while onboarding
a new tenant, `create_tenant()` fires a best-effort, non-blocking call to
`send_tenant_onboarding_email()` after the tenant/admin/DNS/SSL steps all
succeed. It sends a branded HTML email (matches the app's own visual
language — Inter font, `#0d1b3e`/`#2563eb`, dense uppercase labels) containing
the login URL, phone, and password, plus a plain-text fallback.

The email address is **never persisted** — the tenant's own `users` table has
no `email` column, and this deliberately doesn't add one just to support a
one-time welcome message. If SMTP isn't configured, or the admin leaves the
email field blank, tenant creation proceeds exactly as before; nothing about
the core onboarding flow depends on this working.

### Required `.env` keys (not yet set)

Add these to `/opt/crediiflow/.env` and restart the backend container to
enable real sending:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey-or-username
SMTP_PASSWORD=the-real-secret
SMTP_FROM=onboarding@crediiflow.in
```

Any standard SMTP provider (SES, SendGrid, Mailgun, Postmark, a real mailbox)
works — `email.py` only needs STARTTLS on the given host/port plus optional
AUTH; it isn't tied to a specific vendor's API.
