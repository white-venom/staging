# VPS Infrastructure — Everything Outside Version Control

This document exists because several pieces of production infrastructure live
**only on the VPS itself**, not in this git repository. If the server is ever
rebuilt, migrated, or replaced, `git clone` + `docker compose up` alone will
**not** reproduce a working system — the pieces below have to be recreated by
hand, using this document.

Server: `187.127.176.149` (root SSH). Repo checked out at `/opt/crediiflow`.
Deploys via `.github/workflows/deploy.yml` (`git pull` + `docker compose up -d
--build` over SSH on every push to `main`).

Last verified against the live server: 2026-07-20.

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
# dockerized nginx already holding that port. Stop it for the duration of the
# certbot call, then always restart it regardless of outcome.
log "Stopping nginx to free port 80..."
docker stop crediiflow_nginx >>"$LOG_FILE" 2>&1

certbot certonly --standalone --cert-name "$CERT_NAME" --expand \
  "${DOMAIN_ARGS[@]}" \
  --non-interactive --agree-tos --no-eff-email \
  -m admin@xcplllp.com >>"$LOG_FILE" 2>&1
CERTBOT_EXIT=$?

log "Restarting nginx..."
docker start crediiflow_nginx >>"$LOG_FILE" 2>&1

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
the dockerized nginx as above. This had never actually triggered a failure
only because the cert wasn't yet within its 30-day renewal window — but it
would have failed the first time renewal actually ran. Fixed with two hook
scripts (certbot runs anything executable in these directories automatically
around a real renewal):

`/etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh` (mode `755`):

```bash
#!/bin/bash
# Standalone authenticator needs port 80 free; the dockerized nginx holds it.
docker stop crediiflow_nginx
```

`/etc/letsencrypt/renewal-hooks/post/start-nginx.sh` (mode `755`):

```bash
#!/bin/bash
docker start crediiflow_nginx
```

### Current cert status (as of last verification)

```
Certificate Name: api.crediiflow.in
Domains: api.crediiflow.in app.crediiflow.in crediiflow.in do-it-services.crediiflow.in superadmin.crediiflow.in www.crediiflow.in
Authenticator: standalone
Key type: ECDSA
```

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

## 4. Nginx config — `/opt/crediiflow/nginx.conf`

Mounted read-only into the `crediiflow_nginx` container
(`./nginx.conf:/etc/nginx/nginx.conf:ro` per `docker-compose.yml`). This file
is **not** in git — it's hand-maintained directly on the server. Two backup
copies exist alongside it from manual edits on 2026-07-08
(`nginx.conf.bak.20260708070807`, `nginx.conf.bak.20260708072025`) — evidence
someone was editing it by hand that day; no changelog beyond the timestamps.

If nginx routing/rate-limiting/proxy rules are ever debugged or changed,
remember the live config is server-only — consider bringing it into the repo
(even as a reference copy) in a future pass so changes are diffable.

---

## 5. Database backup — script exists, but is **not currently scheduled anywhere**

`backend/backup_postgres_r2.sh` (in git) dumps Postgres, encrypts with
AES-256, and uploads to Cloudflare R2. Its header comment says to install it
as `0 2 * * * /app/backup_postgres_r2.sh`, but as of this writing:

- No host crontab entry for it (`crontab -l` for root: empty).
- No cron installed *inside* the backend container at all (`crontab`: command
  not found — the image doesn't include a cron daemon).
- No docker-compose service runs it.
- The `.env` file (§3) is also missing the variables the script requires to
  even start (`DB_BACKUP_KEY`, `R2_S3_ENDPOINT`, `R2_BACKUP_BUCKET`,
  `POSTGRES_HOST`, `POSTGRES_PORT` are all absent) — the script would exit
  immediately on its own config-validation checks even if invoked manually.

**There is currently no automated database backup running in production.**
A stray one-off dump, `/opt/crediiflow/my_database_backup.sql` (created
2026-06-08, ~325KB), sits in the deploy directory root — almost certainly a
manual `pg_dump` someone ran once, not output from this script (the script
uploads to R2 and deletes its local copy; this file is a plain uncompressed
`.sql`, and its location/naming don't match the script's conventions).

Wiring this up for real (adding the missing `.env` vars, an R2 bucket, and an
actual schedule — host cron calling into the container, or a compose-level
sidecar) is a real gap, not something this document can paper over — flagging
it here so it's visible rather than assumed-handled.

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
5. Recreate `/opt/crediiflow/nginx.conf` (§4 — not in git; check for an
   off-server backup, since the server-local `.bak` copies won't survive a
   rebuild either).
6. Issue the initial cert manually (first issuance, before the watcher has
   anything to expand): `certbot certonly --standalone --cert-name
   api.crediiflow.in -d api.crediiflow.in -d app.crediiflow.in -d
   crediiflow.in -d www.crediiflow.in -d superadmin.crediiflow.in -d
   <each existing tenant subdomain>.crediiflow.in ...` (stop nginx first if
   it's already up).
7. `chown 1002:1001 /opt/crediiflow/triggers; chmod 755 /opt/crediiflow/triggers` (§1).
8. Recreate `/opt/crediiflow/ssl-trigger-watcher.sh` from §1's inline copy,
   `chmod 755`.
9. Recreate the two systemd units from §1, `daemon-reload`, `enable --now`
   the timer.
10. Recreate the two certbot renewal hooks from §1, `chmod 755` both.
11. `docker compose up -d --build`.
12. Set up GitHub Actions secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`) for
    `.github/workflows/deploy.yml` to keep working.
13. Decide what to do about §5 (backups) — currently not running even on the
    old server, so this is a good opportunity to actually wire it up rather
    than reproduce the gap.
