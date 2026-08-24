# Store Management - Quick Setup
# Run: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Store Management - Quick Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = & node --version 2>$null
    Write-Host "  OK Node.js $nodeVer found" -ForegroundColor Green
} catch {
    Write-Host "  X Node.js is not installed." -ForegroundColor Red
    Write-Host "  Download from: https://nodejs.org"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Create .env.docker if missing
Write-Host "[2/4] Checking configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env.docker")) {
    if (Test-Path ".env.docker.example") {
        Copy-Item ".env.docker.example" ".env.docker"
        Write-Host "  Created .env.docker from template" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  IMPORTANT: Edit .env.docker with your Supabase credentials." -ForegroundColor Yellow
    Write-Host "  File: $PWD\.env.docker"
    Write-Host ""
    Write-Host "  Required:"
    Write-Host "    - SUPABASE_URL"
    Write-Host "    - SUPABASE_ANON_KEY"
    Write-Host "    - JWT_SECRET"
    Write-Host ""
    Start-Process notepad ".env.docker"
    Read-Host "  Press Enter after saving .env.docker"
} else {
    Write-Host "  OK .env.docker exists" -ForegroundColor Green
}
Write-Host ""

# Get npm path
$npmPath = (Get-Command npm -ErrorAction SilentlyContinue).Source
if (-not $npmPath) {
    $npmPath = Join-Path (Split-Path (Split-Path (Get-Command node).Source)) "npm.cmd"
}

# Install dependencies
Write-Host "[3/4] Installing dependencies..." -ForegroundColor Yellow
Write-Host "  Server packages..."
Push-Location "server"
& $npmPath install --production --silent 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  X Server install failed" -ForegroundColor Red; Read-Host; exit 1 }
Pop-Location

Write-Host "  Client packages..."
Push-Location "client"
& $npmPath install --silent 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  X Client install failed" -ForegroundColor Red; Read-Host; exit 1 }
Pop-Location
Write-Host "  OK Dependencies installed" -ForegroundColor Green
Write-Host ""

# Build client
Write-Host "[4/4] Building client..." -ForegroundColor Yellow
Push-Location "client"
$env:VITE_API_URL = "/api"
& $npmPath exec -- vite build --mode development --silent 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  X Client build failed" -ForegroundColor Red; Read-Host; exit 1 }
Pop-Location
Write-Host "  OK Client built" -ForegroundColor Green

# Copy env to server
Copy-Item ".env.docker" "server\.env" -Force 2>$null

# Ensure ALLOWED_ORIGINS includes localhost:3001
$envFile = Get-Content "server\.env" -Raw -ErrorAction SilentlyContinue
if ($envFile -and $envFile -notmatch "localhost:3001") {
    $envFile = $envFile -replace "ALLOWED_ORIGINS=(.*)", 'ALLOWED_ORIGINS=$1,http://localhost:3001'
    Set-Content "server\.env" $envFile
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Starting server on http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Login: admin / admin123"
Write-Host "  (You will be forced to change password)"
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server"
Write-Host ""

# Start server
Push-Location "server"
node src\index.js
