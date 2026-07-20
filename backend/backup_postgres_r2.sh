#!/usr/bin/env bash
# ==============================================================================
# Automated Daily Encrypted PostgreSQL Backup to Cloudflare R2 Object Storage
# ==============================================================================
# Dumps the ENTIRE Postgres cluster (pg_dumpall -- every database plus roles/
# globals), encrypts the output archive with AES-256, and pushes it to
# Cloudflare R2 storage via S3 API wrappers.
#
# This is a DB-per-tenant architecture: POSTGRES_DB (the container's default
# bootstrap database) is NOT where the real data lives -- the master tenant
# registry is its own database (crediiflow_master) and every tenant gets its
# own database created at runtime (crediiflow_<subdomain>). A single
# `pg_dump -d $POSTGRES_DB` would back up an empty/irrelevant database and
# silently miss all real data. pg_dumpall covers every database that exists
# at dump time without needing to know their names in advance, so newly
# onboarded tenants are automatically included on the next run.
#
# See docs/VPS_INFRASTRUCTURE.md for how this is scheduled in production
# (it is NOT invoked by anything inside this repo/container -- systemd timer
# on the host).
# ==============================================================================

set -o errexit
set -o pipefail
set -o nounset

# Load environment configurations if available
ENV_FILE="/app/.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
fi

# Check required configurations to avoid insecure fallbacks
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "❌ Error: POSTGRES_PASSWORD is not configured in the environment." >&2
    exit 1
fi

if [ -z "${DB_BACKUP_KEY:-}" ]; then
    echo "❌ Error: DB_BACKUP_KEY is not configured in the environment." >&2
    exit 1
fi

if [ -z "${R2_S3_ENDPOINT:-}" ] || [ "${R2_S3_ENDPOINT}" = "https://your-account-id.r2.cloudflarestorage.com" ]; then
    echo "❌ Error: R2_S3_ENDPOINT is not configured or is set to a placeholder." >&2
    exit 1
fi

# Configuration Variables
DB_USER=${POSTGRES_USER:-"doit_admin"}
DB_HOST=${POSTGRES_HOST:-"db"}
DB_PORT=${POSTGRES_PORT:-"5432"}

BACKUP_DIR="/tmp/pg_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="crediiflow_cluster_backup_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILENAME="${BACKUP_FILENAME}.enc"

# Cloudflare R2 / S3 Configuration Parameters
R2_BUCKET=${R2_BACKUP_BUCKET:-"doit-db-backups"}
R2_ENDPOINT_URL=${R2_S3_ENDPOINT}
BACKUP_ENCRYPTION_KEY=${DB_BACKUP_KEY}

# Ensure local temporary storage directory exists
mkdir -p "$BACKUP_DIR"

echo "🏁 Starting PostgreSQL cluster backup (all databases)..."

# 1. Generate compressed dump of the WHOLE cluster (every database + roles/globals)
echo "📦 Dumping entire Postgres cluster via pg_dumpall..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dumpall -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" | gzip > "${BACKUP_DIR}/${BACKUP_FILENAME}"

# 2. Encrypt the backup file using AES-256-CBC to protect customer ledger data (Task 61)
echo "🔒 Encrypting backup file using AES-256 symmetric cipher..."
openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "${BACKUP_DIR}/${BACKUP_FILENAME}" \
    -out "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" \
    -pass "pass:${BACKUP_ENCRYPTION_KEY}"

# 3. Stream upload directly to Cloudflare R2 Object Storage
# R2 is S3-compatible and requires AWS SigV4-signed requests -- a bare `curl
# PUT` is NOT authenticated and will be rejected (or worse, silently succeed
# against a misconfigured public-write bucket) by any real private bucket.
# There is no safe unsigned fallback, so require the aws CLI outright rather
# than pretend an unsigned PUT is an equivalent upload path.
echo "📤 Uploading encrypted backup file to Cloudflare R2 S3 bucket..."
if ! command -v aws &> /dev/null; then
    echo "❌ Error: 'aws' CLI is required to upload to R2 (SigV4 signing) and is not installed." >&2
    exit 1
fi
aws s3 cp "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" "s3://${R2_BUCKET}/${ENCRYPTED_FILENAME}" \
    --endpoint-url "$R2_ENDPOINT_URL" \
    --no-progress
echo "✅ Backup archive successfully synced to cloud storage!"

# 4. Enforce strict backup retention period locally (Keep last 3 logs)
echo "🧹 Cleaning up local cache directories..."
rm -f "${BACKUP_DIR}/${BACKUP_FILENAME}"
rm -f "${BACKUP_DIR}/${ENCRYPTED_FILENAME}"

echo "🎉 Backup lifecycle successfully completed!"
