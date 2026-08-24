#!/usr/bin/env node

import { createInterface } from 'readline'
import { execSync, spawn } from 'child_process'
import { existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { randomBytes } from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = dirname(__filename)

// ── Helpers ──────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question, fallback = '') {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim() || fallback)
    })
  })
}

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    if (stdin.isTTY) stdin.setRawMode(true)
    let password = ''
    const onData = (ch) => {
      const c = ch.toString()
      if (c === '\n' || c === '\r') {
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false)
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(password)
      } else if (c === '\u0003') {
        process.exit(1)
      } else if (c === '\u007F' || c === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        password += c
        process.stdout.write('*')
      }
    }
    stdin.on('data', onData)
  })
}

function generateSecret() {
  return randomBytes(32).toString('hex')
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: opts.timeout || 30000, ...opts })
    return true
  } catch {
    return false
  }
}

function runOutput(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim()
  } catch {
    return ''
  }
}

function checkVersion(bin, minMajor = 18) {
  const raw = runOutput(`${bin} --version`)
  const match = raw.match(/v?(\d+)/)
  if (!match) return null
  const major = parseInt(match[1], 10)
  return major >= minMajor ? major : null
}

function writeEnvFile(path, content) {
  writeFileSync(path, content + '\n', 'utf-8')
}

function divider() {
  console.log('\n' + '─'.repeat(50) + '\n')
}

// ── Banner ───────────────────────────────────────────────────────────────

function printBanner() {
  console.log('')
  console.log('  ╔═══════════════════════════════════════════════════╗')
  console.log('  ║                                                   ║')
  console.log('  ║         Store Management POS — Setup              ║')
  console.log('  ║         ═══════════════════════════               ║')
  console.log('  ║                                                   ║')
  console.log('  ║  Interactive installer for all platforms          ║')
  console.log('  ║  Windows · Linux · Mac · VPS · Docker             ║')
  console.log('  ║                                                   ║')
  console.log('  ╚═══════════════════════════════════════════════════╝')
  console.log('')
}

// ── Prerequisites Check ─────────────────────────────────────────────────

async function checkPrereqs(mode) {
  console.log('  Checking prerequisites...')

  // Node.js
  const nodeMajor = checkVersion('node', 18)
  if (nodeMajor === null) {
    console.error('\n  ✗ Node.js 18+ is required. Install from https://nodejs.org')
    process.exit(1)
  }
  console.log(`  ✓ Node.js v${nodeMajor}+`)

  // Git
  if (!run('git --version')) {
    console.error('\n  ✗ Git is required. Install from https://git-scm.com')
    process.exit(1)
  }
  console.log('  ✓ Git')

  // Docker (for modes 2 and 3)
  if (mode === 2 || mode === 3) {
    if (!run('docker --version')) {
      console.log('\n  Docker not found. Attempting install...')

      const platform = process.platform
      if (platform === 'linux') {
        const installed = run('curl -fsSL https://get.docker.com | sh')
        if (!installed) {
          console.error('  ✗ Docker install failed. Install manually: https://docs.docker.com/get-docker/')
          process.exit(1)
        }
        run('sudo usermod -aG docker $USER')
        console.log('  ✓ Docker installed (log out and back in for group changes)')
      } else if (platform === 'win32') {
        console.error('  ✗ Install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/')
        process.exit(1)
      } else {
        console.error('  ✗ Install Docker Desktop: https://docs.docker.com/desktop/install/mac-install/')
        process.exit(1)
      }
    } else {
      console.log('  ✓ Docker CLI')
    }

    // Check Docker daemon is actually running
    const daemonRunning = run('docker ps', { timeout: 5000 })
    if (!daemonRunning) {
      console.error('\n  ✗ Docker is installed but the daemon is not running.')
      console.error('    Start Docker Desktop and try again.')
      console.error('    Or choose mode [1] for local development (no Docker needed).')
      process.exit(1)
    }
    console.log('  ✓ Docker daemon is running')

    // Docker Compose
    const composeVersion = runOutput('docker compose version')
    if (!composeVersion) {
      console.error('\n  ✗ Docker Compose plugin is required')
      process.exit(1)
    }
    console.log('  ✓ Docker Compose')
  }

  // Nginx + Certbot (mode 3 only)
  if (mode === 3) {
    const platform = process.platform
    if (platform === 'linux') {
      if (!run('nginx -v')) {
        console.log('  Installing Nginx...')
        run('sudo apt-get update -qq && sudo apt-get install -y nginx')
      }
      console.log('  ✓ Nginx')

      if (!run('certbot --version')) {
        console.log('  Installing Certbot...')
        run('sudo apt-get install -y certbot python3-certbot-nginx')
      }
      console.log('  ✓ Certbot')
    } else {
      console.log('\n  ⚠ VPS mode with Nginx+SSL is only available on Linux.')
      console.log('    On Windows/Mac, use Docker mode instead.')
      process.exit(1)
    }
  }
}

// ── Configuration Prompts ────────────────────────────────────────────────

async function collectConfig(mode) {
  const config = {}

  divider()
  console.log('  Supabase Configuration')
  console.log('  (Get these from https://supabase.com/dashboard → Project Settings → API)')
  console.log('')

  config.supabaseUrl = await ask('  Supabase URL: ')
  if (!config.supabaseUrl) {
    console.error('  ✗ Supabase URL is required')
    process.exit(1)
  }

  config.supabaseAnonKey = await ask('  Supabase Anon Key: ')
  if (!config.supabaseAnonKey) {
    console.error('  ✗ Supabase Anon Key is required')
    process.exit(1)
  }

  config.supabaseServiceKey = await ask('  Supabase Service Key (optional, press Enter to skip): ')

  divider()
  console.log('  Security')
  console.log('')

  config.jwtSecret = generateSecret()
  console.log(`  ✓ Generated JWT Secret: ${config.jwtSecret.substring(0, 12)}...`)

  if (mode === 3) {
    divider()
    console.log('  Domain & SSL')
    console.log('')

    config.domain = await ask('  Your domain (e.g., mystore.com): ')
    if (!config.domain) {
      console.error('  ✗ Domain is required for VPS mode')
      process.exit(1)
    }
    config.domainFull = `https://${config.domain},https://www.${config.domain}`
  } else {
    if (mode === 1) {
      config.domainFull = 'http://localhost,http://localhost:5173,http://localhost:3001'
    } else {
      config.domainFull = 'http://localhost,http://localhost:80,http://localhost:3001'
    }
  }

  divider()
  console.log('  Email (optional — press Enter to skip)')
  console.log('')

  config.resendApiKey = await ask('  Resend API Key: ')
  config.smtpFrom = await ask('  SMTP From Email: ')

  divider()
  return config
}

// ── Generate .env Files ─────────────────────────────────────────────────

function generateServerEnv(config) {
  return `# Supabase Configuration (Required)
SUPABASE_URL=${config.supabaseUrl}
SUPABASE_ANON_KEY=${config.supabaseAnonKey}
${config.supabaseServiceKey ? `SUPABASE_SERVICE_KEY=${config.supabaseServiceKey}` : '# SUPABASE_SERVICE_KEY=your-service-key'}

# JWT Configuration
JWT_SECRET=${config.jwtSecret}
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=${config.domainFull}

# Email (Optional)
${config.resendApiKey ? `RESEND_API_KEY=${config.resendApiKey}` : '# RESEND_API_KEY=your-resend-key'}
${config.smtpFrom ? `SMTP_FROM=${config.smtpFrom}` : '# SMTP_FROM=noreply@example.com'}

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30`
}

function generateDockerEnv(config) {
  return `# Supabase Configuration (Required)
SUPABASE_URL=${config.supabaseUrl}
SUPABASE_ANON_KEY=${config.supabaseAnonKey}
${config.supabaseServiceKey ? `SUPABASE_SERVICE_KEY=${config.supabaseServiceKey}` : '# SUPABASE_SERVICE_KEY=your-service-key'}

# JWT Configuration
JWT_SECRET=${config.jwtSecret}
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=${config.domainFull}

# Email (Optional)
${config.resendApiKey ? `RESEND_API_KEY=${config.resendApiKey}` : '# RESEND_API_KEY=your-resend-key'}
${config.smtpFrom ? `SMTP_FROM=${config.smtpFrom}` : '# SMTP_FROM=noreply@example.com'}

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30`
}

function generateClientEnv() {
  return `VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Store POS`
}

function generateNginxConfig(domain) {
  return `server {
    listen 80;
    server_name ${domain} www.${domain};

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

    location /api/chat {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}`
}

// ── Install Modes ────────────────────────────────────────────────────────

async function installLocal(config) {
  console.log('  Setting up local development environment...\n')

  // Generate server .env
  writeEnvFile(join(ROOT, 'server', '.env'), generateServerEnv(config))
  console.log('  ✓ Created server/.env')

  // Generate client .env.local
  writeEnvFile(join(ROOT, 'client', '.env.local'), generateClientEnv())
  console.log('  ✓ Created client/.env.local')

  divider()
  console.log('  Installing dependencies...\n')

  console.log('  Installing root dependencies...')
  run('npm install', { cwd: ROOT })
  console.log('  ✓ Root dependencies installed')

  console.log('  Installing server dependencies...')
  run('npm install', { cwd: join(ROOT, 'server') })
  console.log('  ✓ Server dependencies installed')

  console.log('  Installing client dependencies...')
  run('npm install', { cwd: join(ROOT, 'client') })
  console.log('  ✓ Client dependencies installed')

  divider()
}

async function installDocker(config) {
  console.log('  Setting up Docker deployment...\n')

  // Generate .env.docker
  writeEnvFile(join(ROOT, '.env.docker'), generateDockerEnv(config))
  console.log('  ✓ Created .env.docker')

  divider()
  console.log('  Building and starting Docker containers...\n')

  const started = run('docker compose up -d --build', { cwd: ROOT })
  if (!started) {
    console.error('\n  ✗ Docker Compose build failed.')
    console.error('    Try: docker compose logs server')
    console.error('    Or run setup again and choose mode [1] for local development.')
    process.exit(1)
  }

  console.log('  ✓ Docker containers started')

  // Verify
  console.log('  Checking container status...')
  run('docker compose ps', { cwd: ROOT })

  divider()
  return { mode: 'docker' }
}

async function installVPS(config) {
  console.log('  Setting up VPS deployment with Docker + Nginx + SSL...\n')

  // Generate .env.docker
  writeEnvFile(join(ROOT, '.env.docker'), generateDockerEnv(config))
  console.log('  ✓ Created .env.docker')

  // Generate nginx config
  const nginxContent = generateNginxConfig(config.domain)
  const nginxPath = join(ROOT, 'nginx.conf')
  writeEnvFile(nginxPath, nginxContent)
  console.log('  ✓ Created nginx.conf')

  // Install Docker if not present
  console.log('  Checking Docker...')
  if (!run('docker --version')) {
    console.log('  Installing Docker...')
    run('curl -fsSL https://get.docker.com | sh')
    run('sudo usermod -aG docker $USER')
    console.log('  ✓ Docker installed')
  } else {
    console.log('  ✓ Docker already installed')
  }

  // Ensure Docker Compose plugin
  if (!run('docker compose version')) {
    console.log('  Installing Docker Compose plugin...')
    run('sudo apt-get update -qq && sudo apt-get install -y docker-compose-plugin')
    console.log('  ✓ Docker Compose plugin installed')
  } else {
    console.log('  ✓ Docker Compose already installed')
  }

  // Install Nginx
  console.log('  Checking Nginx...')
  const nginxCheck = runOutput('nginx -v 2>&1')
  if (!nginxCheck.includes('nginx/')) {
    console.log('  Installing Nginx...')
    run('sudo apt-get update -qq && sudo apt-get install -y nginx')
    console.log('  ✓ Nginx installed')
  } else {
    console.log('  ✓ Nginx already installed')
  }

  // Install Certbot
  console.log('  Checking Certbot...')
  const certbotCheck = runOutput('certbot --version 2>&1')
  if (!certbotCheck.includes('certbot')) {
    console.log('  Installing Certbot...')
    run('sudo apt-get install -y certbot python3-certbot-nginx')
    console.log('  ✓ Certbot installed')
  } else {
    console.log('  ✓ Certbot already installed')
  }

  divider()
  console.log('  Building and starting Docker containers...\n')

  const started = run('docker compose up -d --build', { cwd: ROOT })
  if (!started) {
    console.error('\n  ✗ Docker Compose build failed.')
    console.error('    Try: docker compose logs server')
    console.error('    Or run setup again and choose mode [1] for local development.')
    process.exit(1)
  }
  console.log('  ✓ Docker containers started')

  // Set up Nginx reverse proxy
  divider()
  console.log('  Configuring Nginx reverse proxy...\n')

  run(`sudo cp ${nginxPath} /etc/nginx/sites-available/store-management`)
  run('sudo ln -sf /etc/nginx/sites-available/store-management /etc/nginx/sites-enabled/')
  run('sudo rm -f /etc/nginx/sites-enabled/default')

  const nginxTest = run('sudo nginx -t')
  if (!nginxTest) {
    console.error('  ✗ Nginx config test failed')
    process.exit(1)
  }
  console.log('  ✓ Nginx config valid')

  run('sudo systemctl reload nginx')
  console.log('  ✓ Nginx reloaded')

  // Set up SSL with Certbot
  divider()
  console.log('  Setting up SSL certificate...\n')

  const sslResult = run(`sudo certbot --nginx -d ${config.domain} -d www.${config.domain} --non-interactive --agree-tos --email admin@${config.domain}`)
  if (sslResult) {
    console.log('  ✓ SSL certificate installed')
  } else {
    console.log('  ⚠ SSL setup failed — you can run it manually:')
    console.log(`    sudo certbot --nginx -d ${config.domain} -d www.${config.domain}`)
  }

  // Verify
  divider()
  console.log('  Final status:\n')
  run('docker compose ps', { cwd: ROOT })

  divider()
  return { mode: 'vps' }
}

// ── App Launcher ─────────────────────────────────────────────────────────

function startApp(mode, config) {
  console.log('')
  console.log('  ╔═══════════════════════════════════════════════════╗')
  console.log('  ║                                                   ║')
  console.log('  ║              Setup Complete!                      ║')
  console.log('  ║                                                   ║')
  console.log('  ╚═══════════════════════════════════════════════════╝')
  console.log('')

  if (mode === 1) {
    console.log('  Starting the app...\n')

    // Start server in background
    const server = spawn('node', ['src/index.js'], {
      cwd: join(ROOT, 'server'),
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32',
    })
    server.unref()
    console.log('  ✓ Server started on http://localhost:3001')

    // Cleanup server on exit
    const cleanup = () => {
      try { process.kill(-server.pid) } catch {}
      process.exit()
    }
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('exit', cleanup)

    // Start client (foreground — this blocks until user presses Ctrl+C)
    console.log('  ✓ Starting client on http://localhost:5173...\n')
    console.log('  Press Ctrl+C to stop.\n')

    const client = spawn('npx', ['vite', '--port', '5173'], {
      cwd: join(ROOT, 'client'),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    client.on('close', () => {
      cleanup()
    })

  } else if (mode === 2) {
    console.log('  App is running at http://localhost\n')
    console.log('  Commands:')
    console.log('    docker compose logs -f    # View logs')
    console.log('    docker compose restart    # Restart')
    console.log('    docker compose down       # Stop')
    console.log('')

  } else if (mode === 3) {
    console.log(`  App is running at https://${config.domain}\n`)
    console.log('  Commands:')
    console.log('    docker compose logs -f    # View logs')
    console.log('    docker compose restart    # Restart')
    console.log('    docker compose down       # Stop')
    console.log('    sudo certbot renew --dry-run  # Test SSL renewal')
    console.log('')
  }

  console.log('  🔐 Default Login: admin / admin123')
  console.log('     (You will be forced to change the password on first login)')
  console.log('')
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  printBanner()

  // Choose mode
  console.log('  Choose installation mode:\n')
  console.log('    [1] Local Development  — Node.js only, for development')
  console.log('    [2] Docker (Local)     — Docker Compose, easy local deployment')
  console.log('    [3] VPS (Production)   — Docker + Nginx + SSL for a live server')
  console.log('')

  const modeStr = await ask('  Enter choice (1/2/3): ', '1')
  const mode = parseInt(modeStr, 10)

  if (![1, 2, 3].includes(mode)) {
    console.error('  ✗ Invalid choice. Please enter 1, 2, or 3.')
    process.exit(1)
  }

  console.log(`\n  → Mode: ${mode === 1 ? 'Local Development' : mode === 2 ? 'Docker (Local)' : 'VPS (Production)'}`)

  // Check prerequisites
  divider()
  await checkPrereqs(mode)

  // Collect configuration
  const config = await collectConfig(mode)

  // Install
  if (mode === 1) {
    await installLocal(config)
  } else if (mode === 2) {
    await installDocker(config)
  } else {
    await installVPS(config)
  }

  // Start the app
  rl.close()
  startApp(mode, config)
}

main().catch((err) => {
  console.error('\n  ✗ Setup failed:', err.message)
  process.exit(1)
})
