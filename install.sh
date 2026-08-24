#!/bin/bash
# Store Management - One-Click Setup
# Works with Docker (Linux VPS) or Node.js locally (Windows/Mac/Linux)
# Run: bash install.sh

set -e

# ─── Detect OS ───────────────────────────────────────────
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
elif [[ -n "$WINDIR" ]]; then
    OS="windows"
elif uname -a 2>/dev/null | grep -qi "microsoft\|mingw\|msys"; then
    OS="windows"
elif [ -d "/c/Windows" ] || [ -d "/mnt/c/Windows" ]; then
    OS="windows"
fi

# ─── Colors ───────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
info() { echo -e "${CYAN}  → $1${NC}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Store Management - Quick Setup         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
info "Detected OS: $OS"
echo ""

# ─── Detect mode: Docker or Node.js ─────────────────────
USE_DOCKER=false

if [[ "$OS" == "windows" ]]; then
    for p in "/c/Program Files/Docker/Docker/resources/bin" "/c/Program Files/Docker/Docker" "$LOCALAPPDATA/Docker/cli-plugins"; do
        if [ -d "$p" ]; then
            export PATH="$p:$PATH"
        fi
    done
fi

if command -v docker &> /dev/null && docker info > /dev/null 2>&1; then
    USE_DOCKER=true
    ok "Docker detected — using Docker mode"
elif command -v docker &> /dev/null; then
    warn "Docker found but daemon not running. Trying Node.js mode..."
elif [[ "$OS" == "linux" ]] && command -v sudo &> /dev/null && sudo docker info > /dev/null 2>&1; then
    USE_DOCKER=true
    ok "Docker detected (sudo) — using Docker mode"
fi

# Check Node.js for local mode
if [[ "$USE_DOCKER" == "false" ]]; then
    if ! command -v node &> /dev/null; then
        fail "Node.js is not installed."
        info "Install from: https://nodejs.org"
        exit 1
    fi
    ok "Node.js found: $(node --version)"
    if ! command -v npm &> /dev/null && ! command -v npx &> /dev/null; then
        fail "npm/npx is not installed."
        exit 1
    fi
    ok "npm found: $(npm --version 2>/dev/null || npx --version 2>/dev/null)"
fi

echo ""

# ─── Config: .env.docker ─────────────────────────────────
ENV_FILE=".env.docker"
SKIP_ENV=false

if [ -f "$ENV_FILE" ]; then
    warn ".env.docker already exists."
    read -p "  Overwrite? (y/N): " OVERWRITE
    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        info "Keeping existing .env.docker"
        SKIP_ENV=true
    fi
fi

if [ "$SKIP_ENV" != "true" ]; then

    echo -e "${BOLD}Supabase Configuration${NC}"
    echo -e "  Get these from: ${CYAN}https://supabase.com/dashboard → Settings → API${NC}"
    echo ""

    read -p "  Project URL (e.g. https://xxxx.supabase.co): " SUPABASE_URL
    if [ -z "$SUPABASE_URL" ]; then
        fail "Supabase URL is required"
        exit 1
    fi

    read -p "  Anon Key: " SUPABASE_ANON_KEY
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        fail "Supabase Anon Key is required"
        exit 1
    fi

    read -p "  Service Key (optional, press Enter to skip): " SUPABASE_SERVICE_KEY

    echo ""

    echo -e "${BOLD}Generating JWT Secret...${NC}"
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -hex 32)
    elif [[ "$OS" == "windows" ]]; then
        JWT_SECRET=$(powershell.exe -Command "[System.Guid]::NewGuid().ToString('N') + [System.Guid]::NewGuid().ToString('N')" 2>/dev/null | tr -d '\r')
    elif [[ -r /dev/urandom ]] && command -v head &> /dev/null; then
        JWT_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' | head -c 64)
    else
        JWT_SECRET=$(date +%s%N | sha256sum | head -c 64)
    fi
    [ -z "$JWT_SECRET" ] && JWT_SECRET="changeme_$(date +%s)_$RANDOM"
    ok "JWT Secret generated"

    echo ""

    echo -e "${BOLD}Domain Configuration (optional)${NC}"
    read -p "  Domain name (e.g. mystore.com, press Enter for localhost): " DOMAIN
    if [ -n "$DOMAIN" ]; then
        ALLOWED_ORIGINS="http://localhost,http://localhost:80,http://localhost:3001,http://${DOMAIN},https://${DOMAIN}"
    else
        ALLOWED_ORIGINS="http://localhost,http://localhost:80,http://localhost:3001"
    fi

    echo ""

    echo -e "${BOLD}Email Configuration (optional)${NC}"
    read -p "  Resend API Key (optional, press Enter to skip): " RESEND_API_KEY
    read -p "  Email From (optional, e.g. noreply@mystore.com): " EMAIL_FROM

    echo ""

    cat > "$ENV_FILE" << EOF
# Supabase Configuration (Required)
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

fi

# ─── Build & Start ───────────────────────────────────────
if [[ "$USE_DOCKER" == "true" ]]; then

    echo -e "${BOLD}Building and starting Docker containers...${NC}"
    echo ""

    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        fail "Docker Compose not found."
        exit 1
    fi

    $COMPOSE_CMD up -d --build

    echo ""
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
        echo ""
        echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}║   Setup Complete! (Docker)               ║${NC}"
        echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
        echo ""
        ok "Server: http://localhost"
        ok "API:    http://localhost:3001/api/health"
        echo ""
        echo -e "  ${BOLD}Login:${NC} admin / admin123"
        echo -e "  ${YELLOW}You will be forced to change the password on first login.${NC}"
        echo ""
        echo -e "  ${BOLD}Useful commands:${NC}"
        echo -e "    ${CYAN}$COMPOSE_CMD logs -f server${NC}    View server logs"
        echo -e "    ${CYAN}$COMPOSE_CMD restart${NC}           Restart all services"
        echo -e "    ${CYAN}$COMPOSE_CMD down${NC}              Stop all services"
        echo ""
    else
        fail "Server failed to start within 30 seconds."
        info "Check logs with: $COMPOSE_CMD logs server"
        exit 1
    fi

else

    echo -e "${BOLD}Installing dependencies...${NC}"
    echo ""

    echo "  Installing server packages..."
    cd server
    npm install --production > /dev/null 2>&1 || npx npm install --production > /dev/null 2>&1
    cd ..
    ok "Server packages installed"

    echo "  Installing client packages..."
    cd client
    npm install > /dev/null 2>&1 || npx npm install > /dev/null 2>&1
    cd ..
    ok "Client packages installed"

    echo ""

    echo -e "${BOLD}Building client...${NC}"
    cd client
    VITE_API_URL=/api npx vite build --mode development > /dev/null 2>&1
    cd ..
    ok "Client built"

    # Copy env to server directory (dotenv reads from server/.env)
    cp .env.docker server/.env 2>/dev/null || true

    echo ""

    echo -e "${BOLD}Starting server...${NC}"
    echo ""
    ok "Server starting on http://localhost:3001"
    ok "Login: admin / admin123"
    echo -e "  ${YELLOW}You will be forced to change the password on first login.${NC}"
    echo ""
    echo -e "  ${BOLD}Press Ctrl+C to stop the server${NC}"
    echo ""

    cd server
    exec node src/index.js

fi
