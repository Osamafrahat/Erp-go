// Erp-go Security Audit Script
// Run: node tests/security-audit.js
// This checks for common security issues in the codebase

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

let issues = 0
let warnings = 0

function error(msg) {
  issues++
  console.log(`\x1b[31m[FAIL]\x1b[0m ${msg}`)
}

function warn(msg) {
  warnings++
  console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`)
}

function pass(msg) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`)
}

// --- 1. Check .env files are not committed ---
console.log('\n=== .env File Security ===')
const envFiles = ['.env', '.env.local', '.env.production']
for (const f of envFiles) {
  const p = path.join(root, f)
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8')
    if (content.includes('service_role') || content.includes('SUPABASE_SERVICE_KEY')) {
      const hasRealKey = content.match(/SUPABASE_SERVICE_KEY\s*=\s*sb_publishable/)
      if (hasRealKey) {
        warn(`${f}: SUPABASE_SERVICE_KEY appears to be an anon key, not service_role`)
      }
    }
    pass(`${f} exists (keep out of git)`)
  }
}

// --- 2. Check .gitignore ---
console.log('\n=== .gitignore ===')
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8')
if (gitignore.includes('.env')) {
  pass('.env is in .gitignore')
} else {
  error('.env is NOT in .gitignore — secrets may be committed!')
}

// --- 3. Check for hardcoded secrets ---
console.log('\n=== Hardcoded Secrets ===')
const secretPatterns = [
  { pattern: /sb_publishable_[a-zA-Z0-9_-]{20,}/g, name: 'Supabase anon key' },
  { pattern: /sk_live_[a-zA-Z0-9]+/, name: 'Stripe live secret key' },
  { pattern: /sk_test_[a-zA-Z0-9]+/, name: 'Stripe test secret key' },
  { pattern: /password\s*[:=]\s*["'][^"']+["']/gi, name: 'Hardcoded password' },
]

const srcDirs = ['server/src', 'client/src']
for (const dir of srcDirs) {
  const dirPath = path.join(root, dir)
  if (!fs.existsSync(dirPath)) continue

  function scanDir(d) {
    const files = fs.readdirSync(d, { withFileTypes: true })
    for (const f of files) {
      const fp = path.join(d, f.name)
      if (f.isDirectory() && !f.name.includes('node_modules') && !f.name.includes('__tests__')) {
        scanDir(fp)
      } else if (f.name.endsWith('.js') || f.name.endsWith('.jsx')) {
        const content = fs.readFileSync(fp, 'utf8')
        for (const { pattern, name } of secretPatterns) {
          if (pattern.test(content)) {
            // Ignore test files and placeholder examples
            if (!fp.includes('__tests__') && !fp.includes('test')) {
              warn(`${fp}: Potential ${name} found`)
            }
          }
          pattern.lastIndex = 0 // reset regex
        }
      }
    }
  }
  scanDir(dirPath)
}

// --- 4. Check helmet is used ---
console.log('\n=== Security Middleware ===')
const indexFile = fs.readFileSync(path.join(root, 'server/src/index.js'), 'utf8')
if (indexFile.includes("import helmet from 'helmet'")) {
  pass('Helmet is imported')
} else {
  error('Helmet not imported — no security headers!')
}

if (indexFile.includes('app.use(helmet')) {
  pass('Helmet is applied')
} else {
  error('Helmet is not applied as middleware!')
}

if (indexFile.includes('rateLimit')) {
  pass('Rate limiting is configured')
} else {
  error('No rate limiting — vulnerable to brute force!')
}

if (indexFile.includes("app.disable('x-powered-by')")) {
  pass('X-Powered-By is disabled')
} else {
  warn('X-Powered-By header not explicitly disabled')
}

// --- 5. Check JWT secret ---
console.log('\n=== JWT Configuration ===')
if (process.env.JWT_SECRET) {
  pass('JWT_SECRET is set in environment')
} else {
  warn('JWT_SECRET not set in current environment (OK for audit)')
}

// --- 6. Check CORS ---
console.log('\n=== CORS Configuration ===')
if (indexFile.includes('cors')) {
  pass('CORS is configured')
} else {
  error('No CORS configuration — vulnerable to cross-origin attacks!')
}

if (indexFile.includes('allowedOrigins')) {
  pass('CORS has origin allowlist')
} else {
  warn('CORS may allow all origins')
}

// --- 7. Check for console.log leaks ---
console.log('\n=== Console.log Leak Check ===')
function checkConsoleLeaks(d) {
  const files = fs.readdirSync(d, { withFileTypes: true })
  for (const f of files) {
    const fp = path.join(d, f.name)
    if (f.isDirectory() && !f.name.includes('node_modules') && !f.name.includes('__tests__')) {
      checkConsoleLeaks(fp)
    } else if (f.name.endsWith('.js') || f.name.endsWith('.jsx')) {
      const content = fs.readFileSync(fp, 'utf8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('console.log') && (
          lines[i].toLowerCase().includes('password') ||
          lines[i].toLowerCase().includes('secret') ||
          lines[i].toLowerCase().includes('token') ||
          lines[i].toLowerCase().includes('key')
        )) {
          warn(`${fp}:${i + 1}: Possible secret logged via console.log`)
        }
      }
    }
  }
}
checkConsoleLeaks(path.join(root, 'server/src'))
checkConsoleLeaks(path.join(root, 'client/src'))

// --- Summary ---
console.log('\n' + '='.repeat(50))
console.log(`Security Audit Complete`)
console.log(`\x1b[31mErrors: ${issues}\x1b[0m`)
console.log(`\x1b[33mWarnings: ${warnings}\x1b[0m`)
console.log('='.repeat(50))

process.exit(issues > 0 ? 1 : 0)
