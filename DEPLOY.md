# Deployment Guide

Complete guide to deploy Store Management POS on any platform.

---

## Quick Install (One Command)

Works on **Windows, Linux, and Mac**. Interactive setup guides you through everything.

```bash
git clone https://github.com/Osamafrahat/Erp-go.git
cd Erp-go
node setup.js
```

Or using npm:

```bash
git clone https://github.com/Osamafrahat/Erp-go.git
cd Erp-go
npm run setup
```

The script will:
1. Check your prerequisites (Node.js, Git, Docker if needed)
2. Ask you to choose a mode: **Local Dev**, **Docker**, or **VPS**
3. Prompt for your Supabase credentials
4. Generate a secure JWT secret automatically
5. Create all `.env` files
6. Install dependencies and start the app
7. Print your URL and login credentials

---

## Manual Setup

## Prerequisites

| Requirement | Details |
|---|---|
| **VPS** | Ubuntu 22.04+ / Debian 12+, 2GB RAM minimum |
| **Domain** | Buy from Namecheap, Cloudflare, or Google Domains (~$10/year) |
| **Supabase** | Free account at [supabase.com](https://supabase.com) |
| **SSH access** | Terminal access to your VPS |

---

## Step 1: Domain & DNS Setup

1. Buy a domain (e.g., `mystore.com`)
2. In your domain registrar's DNS settings, add:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_VPS_IP |
| A | www | YOUR_VPS_IP |

3. Wait 5-15 minutes for DNS propagation

---

## Step 2: Server Initial Setup

SSH into your VPS and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Install Nginx
sudo apt install nginx -y

# Install Certbot (free SSL)
sudo apt install certbot python3-certbot-nginx -y

# Log out and back in for Docker group
exit
```

Log back in, then verify:
```bash
docker --version
docker compose version
```

---

## Step 3: Clone & Configure

```bash
# Clone the repo
git clone https://github.com/Osamafrahat/store-management.git
cd store-management

# Create environment file
cp .env.docker.example .env.docker
nano .env.docker
```

Fill in `.env.docker` with your values:

```env
PORT=3001
NODE_ENV=production
JWT_SECRET=YOUR_LONG_RANDOM_STRING_HERE
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_KEY
ALLOWED_ORIGINS=https://mystore.com,https://www.mystore.com
RESEND_API_KEY=YOUR_RESEND_KEY
SMTP_FROM=noreply@mystore.com
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
```

### Generate JWT_SECRET

```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows (PowerShell):
# [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
```

### Get Supabase Credentials

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project → **Settings** → **API**
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY`

### Set CORS

`ALLOWED_ORIGINS` must include your domain:
```
ALLOWED_ORIGINS=https://mystore.com,https://www.mystore.com
```

---

## Step 4: Build & Launch

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f server
```

The server runs on port `3001` and the client on port `80` (via Nginx).

---

## Step 5: Nginx Reverse Proxy + SSL

Create an Nginx config for your domain:

```bash
sudo nano /etc/nginx/sites-available/store-management
```

Paste this (replace `mystore.com` with your domain):

```nginx
server {
    listen 80;
    server_name mystore.com www.mystore.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 5M;
    }

    # WebSocket support
    location /api/chat {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/store-management /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Get Free SSL Certificate

```bash
sudo certbot --nginx -d mystore.com -d www.mystore.com
```

Follow the prompts. Certbot auto-renews certificates.

Verify:
```bash
sudo certbot renew --dry-run
```

---

## Step 6: Database Migrations

Run these SQL statements in your Supabase SQL Editor ([supabase.com/dashboard](https://supabase.com/dashboard) → SQL Editor):

```sql
-- Service order support
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'product';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT;

-- ETA (Egyptian Tax Authority) support
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_uuid TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_qr_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_submitted_at TIMESTAMPTZ;
```

---

## Step 7: Default Login

Open `https://mystore.com` in your browser:

- **Username:** `admin`
- **Password:** `admin123`

You will be forced to change the password on first login.

---

## Step 8: Backup Configuration

Backups are automatic if `BACKUP_ENABLED=true` in `.env.docker`.

Manual backup:
```bash
# List backups
docker compose exec server node -e "import('./src/services/backupService.js').then(b => b.listBackups().then(r => console.log(JSON.stringify(r, null, 2))))"

# Create backup now
docker compose exec server node -e "import('./src/services/backupService.js').then(b => b.backupToJson())"
```

Backups are stored in a Docker volume named `backups`.

---

## Step 9: Maintenance Commands

```bash
# View logs
docker compose logs -f server
docker compose logs -f client

# Restart services
docker compose restart

# Rebuild after code changes
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove volumes (DELETES data)
docker compose down -v
```

---

## Troubleshooting

### Server won't start
```bash
docker compose logs server
```
Common causes: missing env vars, wrong Supabase credentials.

### 502 Bad Gateway
```bash
docker compose ps
docker compose logs server
```
The server container is probably crashed. Check logs above.

### CORS errors in browser
Ensure `ALLOWED_ORIGINS` in `.env.docker` includes your domain with `https://`.

### Login fails
1. Check Supabase credentials are correct
2. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` match your Supabase project
3. Check server logs for errors

### SSL not working
```bash
sudo nginx -t
sudo certbot certificates
sudo certbot renew
```

---

## Alternative: Fly.io + Vercel (Cloud)

If you prefer cloud hosting without managing a VPS:

### Server (Fly.io)
1. Push code to GitHub
2. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
3. Login: `fly auth login`
4. Launch: `fly launch` (from project root — auto-detects `fly.toml`)
5. Set secrets: `fly secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... JWT_SECRET=... FRONTEND_URL=https://your-app.vercel.app`
6. Deploy: `fly deploy`

> **Note:** Fly.io uses `fly.toml` for configuration. The existing `server/Dockerfile` is used directly.

### Client (Vercel)
1. Go to [vercel.com](https://vercel.com) → Import Git Repository
2. Set environment variable:
   - `VITE_API_URL` = `https://erp-go.fly.dev/api`
3. Deploy

### Database (Supabase)
Both Fly.io and Vercel connect to the same Supabase database. Run the SQL migrations from Step 6 in your Supabase SQL Editor.
