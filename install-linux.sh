#!/bin/bash
# Store Management - Full Linux VPS Setup
# For Ubuntu 22.04+ / Debian 12+
# Run: bash install-linux.sh

set -e

# ─── Colors ───────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
info() { echo -e "${CYAN}  → $1${NC}"; }

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Store Management - Linux VPS Full Setup          ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Check root ──────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    warn "Not running as root. Some commands will use sudo."
fi

# ═══════════════════════════════════════════════════════════
# PART 1: SYSTEM SETUP
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}━━━ Part 1: System Setup ━━━${NC}"
echo ""

# ─── 1. Update system ───────────────────────────────────
echo -e "${BOLD}[1/6] Updating system packages...${NC}"
sudo apt update -qq > /dev/null 2>&1
sudo apt upgrade -y -qq > /dev/null 2>&1
ok "System updated"

# ─── 2. Install Docker ──────────────────────────────────
echo -e "${BOLD}[2/6] Installing Docker...${NC}"

if command -v docker &> /dev/null; then
    ok "Docker already installed: $(docker --version 2>&1 | head -1)"
else
    info "Downloading Docker installer..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh > /dev/null 2>&1
    rm -f /tmp/get-docker.sh
    ok "Docker installed"
fi

# Add user to docker group
if ! groups $USER | grep -q docker; then
    sudo usermod -aG docker $USER
    warn "User '$USER' added to docker group. Run 'newgrp docker' or re-login for changes."
fi

# ─── 3. Install Docker Compose ──────────────────────────
echo -e "${BOLD}[3/6] Installing Docker Compose plugin...${NC}"

if docker compose version &> /dev/null 2>&1; then
    ok "Docker Compose already installed"
else
    sudo apt install -y docker-compose-plugin -qq > /dev/null 2>&1
    ok "Docker Compose installed"
fi

# ─── 4. Install Nginx ──────────────────────────────────
echo -e "${BOLD}[4/6] Installing Nginx...${NC}"

if command -v nginx &> /dev/null; then
    ok "Nginx already installed"
else
    sudo apt install -y nginx -qq > /dev/null 2>&1
    sudo systemctl enable nginx > /dev/null 2>&1
    sudo systemctl start nginx > /dev/null 2>&1
    ok "Nginx installed and started"
fi

# ─── 5. Install Certbot ────────────────────────────────
echo -e "${BOLD}[5/6] Installing Certbot (SSL)...${NC}"

if command -v certbot &> /dev/null; then
    ok "Certbot already installed"
else
    sudo apt install -y certbot python3-certbot-nginx -qq > /dev/null 2>&1
    ok "Certbot installed"
fi

# ─── 6. Install git ────────────────────────────────────
echo -e "${BOLD}[6/6] Checking git...${NC}"

if command -v git &> /dev/null; then
    ok "Git already installed"
else
    sudo apt install -y git -qq > /dev/null 2>&1
    ok "Git installed"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# PART 2: CONFIGURATION
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}━━━ Part 2: Configuration ━━━${NC}"
echo ""

# ─── Prompt for domain ──────────────────────────────────
echo -e "${BOLD}Domain Configuration${NC}"
read -p "  Enter your domain (e.g. mystore.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    fail "Domain is required for production setup."
fi

# Check if domain resolves to this server
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null)
info "Your server IP: $SERVER_IP"
info "Make sure DNS A record for $DOMAIN points to $SERVER_IP"
echo ""
read -p "  Press Enter when DNS is ready (or Ctrl+C to exit)..."

echo ""

# ─── Prompt for Supabase credentials ────────────────────
echo -e "${BOLD}Supabase Configuration${NC}"
echo -e "  Get these from: ${CYAN}https://supabase.com/dashboard → Settings → API${NC}"
echo ""

read -p "  Project URL (e.g. https://xxxx.supabase.co): " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
    fail "Supabase URL is required"
fi

read -p "  Anon Key: " SUPABASE_ANON_KEY
if [ -z "$SUPABASE_ANON_KEY" ]; then
    fail "Supabase Anon Key is required"
fi

read -p "  Service Key (optional, press Enter to skip): " SUPABASE_SERVICE_KEY

echo ""

# ─── Generate JWT_SECRET ────────────────────────────────
echo -e "${BOLD}Generating JWT Secret...${NC}"
JWT_SECRET=$(openssl rand -hex 32)
ok "JWT Secret generated"

echo ""

# ─── Prompt for email (optional) ────────────────────────
echo -e "${BOLD}Email Configuration (optional)${NC}"
read -p "  Resend API Key (press Enter to skip): " RESEND_API_KEY
read -p "  Email From (e.g. noreply@mystore.com): " EMAIL_FROM

echo ""

# ─── Clone repo ─────────────────────────────────────────
echo -e "${BOLD}Cloning repository...${NC}"

REPO_DIR="/var/www/store-management"
if [ -d "$REPO_DIR" ]; then
    warn "Directory $REPO_DIR already exists."
    read -p "  Pull latest changes? (Y/n): " PULL
    if [[ ! "$PULL" =~ ^[Nn]$ ]]; then
        cd "$REPO_DIR"
        git pull origin master
        ok "Updated to latest version"
    fi
else
    sudo git clone https://github.com/Osamafrahat/store-management.git "$REPO_DIR"
    ok "Repository cloned to $REPO_DIR"
fi

cd "$REPO_DIR"

echo ""

# ─── Write .env.docker ──────────────────────────────────
echo -e "${BOLD}Creating .env.docker...${NC}"

ALLOWED_ORIGINS="http://localhost,http://localhost:80,http://${DOMAIN},https://${DOMAIN}"

cat > .env.docker << EOF
# Supabase Configuration
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}

# Email (Optional)
RESEND_API_KEY=${RESEND_API_KEY}
SMTP_FROM=${EMAIL_FROM}

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
EOF

ok ".env.docker created"

echo ""

# ═══════════════════════════════════════════════════════════
# PART 3: BUILD & LAUNCH
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}━━━ Part 3: Build & Launch ━━━${NC}"
echo ""

echo -e "${BOLD}Building Docker containers...${NC}"
sudo docker compose up -d --build
ok "Containers started"

echo ""

# ─── Health Check ───────────────────────────────────────
echo -e "${BOLD}Waiting for server to start...${NC}"

MAX_RETRIES=30
RETRIES=0
HEALTHY=false

while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    RETRIES=$((RETRIES + 1))
    sleep 1
    echo -n "."
done
echo ""

if [ "$HEALTHY" = true ]; then
    ok "Server is healthy"
else
    fail "Server failed to start. Check: sudo docker compose logs server"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# PART 4: NGINX + SSL
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}━━━ Part 4: Nginx Reverse Proxy ━━━${NC}"
echo ""

# ─── Create Nginx config ────────────────────────────────
echo -e "${BOLD}Configuring Nginx...${NC}"

sudo tee /etc/nginx/sites-available/store-management > /dev/null << NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        client_max_body_size 5M;
    }

    location /api/chat {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
NGINX

# Enable site
sudo ln -sf /etc/nginx/sites-available/store-management /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
if sudo nginx -t > /dev/null 2>&1; then
    sudo systemctl reload nginx
    ok "Nginx configured and reloaded"
else
    fail "Nginx config test failed. Check: sudo nginx -t"
fi

echo ""

# ─── SSL with Certbot ──────────────────────────────────
echo -e "${BOLD}━━━ Part 5: SSL Certificate ━━━${NC}"
echo ""

read -p "  Install free SSL certificate with Let's Encrypt? (Y/n): " SSL_CHOICE
if [[ ! "$SSL_CHOICE" =~ ^[Nn]$ ]]; then
    info "Running Certbot..."
    sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        ok "SSL certificate installed"
        sudo certbot renew --dry-run > /dev/null 2>&1
        ok "Auto-renewal configured"
    else
        warn "Certbot failed. You can try manually later:"
        warn "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    fi
else
    info "Skipping SSL. You can install it later with:"
    info "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Setup Complete!                                 ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}      https://${DOMAIN}"
echo -e "  ${BOLD}Login:${NC}    admin / admin123"
echo -e "  ${BOLD}Warning:${NC}  You will be forced to change password on first login"
echo ""
echo -e "  ${BOLD}Nginx:${NC}    /etc/nginx/sites-available/store-management"
echo -e "  ${BOLD}Docker:${NC}   ${REPO_DIR}"
echo -e "  ${BOLD}Env:${NC}      ${REPO_DIR}/.env.docker"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    ${CYAN}cd ${REPO_DIR} && sudo docker compose logs -f server${NC}"
echo -e "    ${CYAN}cd ${REPO_DIR} && sudo docker compose restart${NC}"
echo -e "    ${CYAN}cd ${REPO_DIR} && sudo docker compose down${NC}"
echo -e "    ${CYAN}sudo nginx -t && sudo systemctl reload nginx${NC}"
echo -e "    ${CYAN}sudo certbot renew --dry-run${NC}"
echo ""
echo -e "  ${YELLOW}⚠ Run SQL migrations in Supabase dashboard:${NC}"
echo -e "  ${CYAN}See DEPLOY.md → Step 6${NC}"
echo ""
