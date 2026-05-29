# DO IT SERVICES - Production Deployment Guide

This guide provides step-by-step instructions to deploy the DO IT SERVICES Progressive Web App (PWA), FastAPI backend, and PostgreSQL database on a **Hostinger KVM4 VPS**, utilizing **Cloudflare R2** for static storage and daily encrypted backups.

---

## Architecture Overview

```
                     [ User App / Mobile PWA ]
                                │
                        (Cloudflare CDN / WAF)
                                │
                     ┌──────────▼──────────┐
                     │  Hostinger KVM4 VPS │
                     │                     │
                     │  ┌───────────────┐  │
                     │  │  Nginx Proxy  │  │
                     │  └──────┬────────┘  │
                     │         │           │
            ┌────────┼─────────┼───────────┼────────┐
            │        │         │           │        │
    ┌───────▼──────┐ │ ┌───────▼──────┐    │ ┌──────▼──────┐
    │ Next.js Web  │ │ │ FastAPI API  │    │ │ PostgreSQL  │
    │  (Port 3000) │ │ │  (Port 8000) │    │ │  (Port 5432)│
    └──────────────┘ │ └───────┬──────┘    │ └──────┬──────┘
                     └─────────┼───────────┼────────┘
                               │           │
              (Upload Images)  │           │  (Daily Backup)
                               ▼           ▼
                     [ Cloudflare R2 Object Storage ]
```

---

## Step 1: Cloudflare Setup (DNS & SSL)

1. **DNS Mapping**: In your Cloudflare Dashboard, add two `A` records pointing to your KVM4 VPS public IP address:
   * `app.doitservices.in` (Frontend)
   * `api.doitservices.in` (Backend API)
   * **Proxy Status**: Toggle **ON** (Orange Cloud) for both records.
2. **SSL/TLS Policies**:
   * Navigate to **SSL/TLS -> Overview** and set encryption mode to **Full (Strict)**.
   * Go to **SSL/TLS -> Edge Certificates** and toggle **Always Use HTTPS** to **ON**.
   * Set the **Minimum TLS Version** to **TLS 1.2**.

---

## Step 2: VPS Server Initialization

Log in to your Hostinger VPS via SSH and install the required tools:

```bash
# Update local packages
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose-v2

# Start and enable Docker daemon
sudo systemctl enable --now docker

# Install Certbot for SSL automation
sudo apt install -y certbot
```

---

## Step 3: Issue SSL Certificates (Let's Encrypt)

Before booting Nginx in Docker, generate the certificates on the host to avoid startup crashes due to missing `.pem` files referenced in `nginx.conf`:

```bash
# Stop any local web servers temporarily if active
sudo systemctl stop nginx || true

# Request certificates for both domains using standalone mode
sudo certbot certonly --standalone \
  -d app.doitservices.in \
  -d api.doitservices.in \
  --agree-tos \
  --email admin@doitservices.in \
  --non-interactive
```

The certificates will be generated at `/etc/letsencrypt/live/`. These paths are mounted directly into the `doit_nginx` container via `docker-compose.yml`.

---

## Step 4: Configure Cloudflare R2 Buckets

1. **Create Buckets**: Log into the Cloudflare Dashboard, go to **R2**, and create two buckets:
   * `doit-static-storage` (For check-in/out odometer images)
   * `doit-db-backups` (For daily PostgreSQL database backups)
2. **Configure CORS/Public Access**:
   * For the `doit-static-storage` bucket, go to the **Settings** tab and configure a custom domain (e.g. `static.doitservices.in`) or enable the R2 Public Dev URL to display odometer images to admins on their dashboards.
3. **Generate R2 Credentials**:
   * In R2 home, click **Manage R2 API Tokens**.
   * Click **Create API Token**, select the **Edit: Read and Write** permissions, and create the token.
   * Copy the **Access Key ID**, **Secret Access Key**, and **Endpoint URL** (format: `https://<account_id>.r2.cloudflarestorage.com`).

---

## Step 5: Configure the Production Environment (`.env`)

Create a `.env` file in the root directory (`/app/.env` or the directory containing your project) with the following variables:

```ini
# ==============================================================================
# Database Configuration
# ==============================================================================
POSTGRES_DB=doit_production
POSTGRES_USER=doit_admin
POSTGRES_PASSWORD=EnterAComplexSecurePasswordHere123!
DATABASE_URL=postgresql://doit_admin:EnterAComplexSecurePasswordHere123!@db:5432/doit_production

# ==============================================================================
# JWT Security Details
# ==============================================================================
JWT_SECRET_KEY=GenerateA32ByteHexSecretHereUseOpenSSL
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# ==============================================================================
# Cloudflare R2 Configuration (For Static Storage)
# ==============================================================================
R2_ACCESS_KEY_ID=your_cloudflare_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_cloudflare_r2_secret_access_key
R2_ENDPOINT_URL=https://your-cloudflare-account-id.r2.cloudflarestorage.com
R2_BUCKET_NAME=doit-static-storage
R2_PUBLIC_URL=https://static.doitservices.in # Mapped custom domain or R2 dev subdomain

# ==============================================================================
# Backup Configuration (For Daily DB Backups)
# ==============================================================================
R2_BACKUP_BUCKET=doit-db-backups
R2_S3_ENDPOINT=https://your-cloudflare-account-id.r2.cloudflarestorage.com
DB_BACKUP_KEY=EnterASecureEncryptionPassphraseHereToSecureBackups
```

---

## Step 6: Build & Start the Application

Build the Docker containers and start the backend, frontend, PostgreSQL DB, and Nginx proxy services in detached mode:

```bash
# Pull images and build custom frontend/backend containers
docker compose build --no-cache

# Boot up the stack
docker compose up -d
```

### Verifying Deploy Status
Check that all containers are healthy:
```bash
docker compose ps
```
Verify logs if a container fails to start:
```bash
docker compose logs -f backend
```

---

## Step 7: Automating Daily Database Backups

The `backup_postgres_r2.sh` script dumps your database, encrypts the output with AES-256 (using your `DB_BACKUP_KEY`), and uploads it to R2.

1. **Configure S3 credentials on the Host VPS**:
   To allow the `aws s3 cp` command in the script to access Cloudflare R2, create an AWS configuration file on the VPS:
   ```bash
   mkdir -p ~/.aws
   cat <<EOF > ~/.aws/credentials
   [default]
   aws_access_key_id = your_cloudflare_r2_access_key_id
   aws_secret_access_key = your_cloudflare_r2_secret_access_key
   EOF
   ```
2. **Test Backup Script Execution**:
   ```bash
   # Make the script executable
   chmod +x ./backend/backup_postgres_r2.sh

   # Dry run execution (make sure env values map correctly)
   docker compose exec -T backend /app/backup_postgres_r2.sh
   ```
3. **Automate with Cron**:
   Add a daily cron job to run the backup script automatically at 2:00 AM:
   ```bash
   # Open user crontab editor
   crontab -e
   ```
   Add the following line to the crontab:
   ```cron
   0 2 * * * docker exec -t doit_backend /app/backup_postgres_r2.sh >> /var/log/doit_backups.log 2>&1
   ```

---

## Step 8: Decrypting and Restoring a Backup

If you ever need to restore your database from a backup file stored in R2:

1. Download the encrypted `.enc` file from your `doit-db-backups` R2 bucket.
2. Decrypt the file using your `DB_BACKUP_KEY`:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -in doit_production_backup_YYYYMMDD_HHMMSS.sql.gz.enc \
     -out decrypted_backup.sql.gz \
     -pass pass:YourSecureEncryptionPassphraseHere
   ```
3. Decompress the decrypted SQL archive:
   ```bash
   gunzip decrypted_backup.sql.gz
   ```
4. Restore into the target PostgreSQL database:
   ```bash
   cat decrypted_backup.sql | docker exec -i doit_db psql -U doit_admin -d doit_production
   ```
