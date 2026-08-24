import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import { errorHandler } from './middleware/errorHandler.js'
import { activityLogger } from './middleware/activityLogger.js'
import { authRouter } from './routes/auth.js'
import { authenticateToken, requireManager } from './middleware/auth.js'

import productsRouter from './routes/products.js'
import categoriesRouter from './routes/categories.js'
import ordersRouter from './routes/orders.js'
import stockRouter from './routes/stock.js'
import suppliersRouter from './routes/suppliers.js'
import promotionsRouter from './routes/promotions.js'
import reportsRouter from './routes/reports.js'
import settingsRouter from './routes/settings.js'
import usersRouter from './routes/users.js'
import customersRouter from './routes/customers.js'
import employeesRouter from './routes/employees.js'
import expensesRouter from './routes/expenses.js'
import refundsRouter from './routes/refunds.js'
import emailRouter from './routes/email.js'
import activitiesRouter from './routes/activities.js'
import { accountsRouter } from './routes/accounts.js'
import { journalsRouter } from './routes/journals.js'
import { accountingReportsRouter } from './routes/accountingReports.js'
import { paymentsRouter } from './routes/payments.js'
import syncRouter from './routes/sync.js'
import etaRouter from './routes/eta.js'
import { backupRouter } from './routes/backup.js'
import { startBackupScheduler } from './services/backupScheduler.js'
import { startAttendanceCron, runAutoClockOut } from './services/attendanceCron.js'
import chatRouter from './routes/chat.js'
import attendanceRouter from './routes/attendance.js'
import leaveRouter from './routes/leave.js'
import payrollRouter from './routes/payroll.js'
import shiftsRouter from './routes/shifts.js'
import performanceRouter from './routes/performance.js'
import servicesRouter from './routes/services.js'
import servicePlansRouter from './routes/servicePlans.js'
import subscriptionsRouter from './routes/subscriptions.js'

const app = express()
const PORT = process.env.PORT || 3001

app.set('trust proxy', 1)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDist = path.join(__dirname, '../../client/dist')

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false
}))

app.use(express.static(clientDist))

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.length === 0) {
      // No origins configured — allow all in dev, reject in production
      if (process.env.NODE_ENV === 'production') {
        return callback(null, true)
      }
      return callback(new Error('CORS not configured'))
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}
app.use(cors(corsOptions))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/change-password', authLimiter)

app.disable('x-powered-by')

app.use('/api/auth', authRouter)

app.use('/api/products', authenticateToken, activityLogger, productsRouter)
app.use('/api/categories', authenticateToken, activityLogger, categoriesRouter)
app.use('/api/orders', authenticateToken, activityLogger, ordersRouter)
app.use('/api/stock', authenticateToken, activityLogger, stockRouter)
app.use('/api/suppliers', authenticateToken, activityLogger, suppliersRouter)
app.use('/api/promotions', authenticateToken, activityLogger, promotionsRouter)
app.use('/api/reports', authenticateToken, activityLogger, reportsRouter)
app.use('/api/settings', activityLogger, settingsRouter)
app.use('/api/users', authenticateToken, requireManager, activityLogger, usersRouter)
app.use('/api/customers', authenticateToken, activityLogger, customersRouter)
app.use('/api/employees', authenticateToken, activityLogger, employeesRouter)
app.use('/api/expenses', authenticateToken, activityLogger, expensesRouter)
app.use('/api/refunds', authenticateToken, activityLogger, refundsRouter)
app.use('/api/notifications', authenticateToken, activityLogger, emailRouter)
app.use('/api/activities', authenticateToken, requireManager, activitiesRouter)

app.use('/api/accounting/accounts', authenticateToken, requireManager, activityLogger, accountsRouter)
app.use('/api/accounting/journals', authenticateToken, requireManager, activityLogger, journalsRouter)
app.use('/api/accounting/reports', authenticateToken, requireManager, accountingReportsRouter)
app.use('/api/accounting/payments', authenticateToken, requireManager, activityLogger, paymentsRouter)
app.use('/api/sync', authenticateToken, syncRouter)
app.use('/api/eta', authenticateToken, etaRouter)
app.use('/api/backup', authenticateToken, requireManager, activityLogger, backupRouter)
app.use('/api/chat', authenticateToken, chatRouter)
app.use('/api/attendance', authenticateToken, activityLogger, attendanceRouter)
app.use('/api/leave', authenticateToken, activityLogger, leaveRouter)
app.use('/api/payroll', authenticateToken, activityLogger, payrollRouter)
app.use('/api/shifts', authenticateToken, activityLogger, shiftsRouter)
app.use('/api/performance', authenticateToken, activityLogger, performanceRouter)
app.use('/api/services', authenticateToken, activityLogger, servicesRouter)
app.use('/api/service-plans', authenticateToken, activityLogger, servicePlansRouter)
app.use('/api/subscriptions', authenticateToken, activityLogger, subscriptionsRouter)

app.get('/api/health', (req, res) => {
  const emailConfigured = !!(process.env.RESEND_API_KEY)
  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS)
  console.log(`[HEALTH] email=${emailConfigured} smtp=${smtpConfigured}`)
  res.json({
    status: 'ok',
    smtp: emailConfigured || smtpConfigured,
    timestamp: new Date().toISOString(),
  })
})

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.use(errorHandler)

// Auto-initialize accounting data on startup
async function initAccounting() {
  try {
    const { seedChartOfAccounts, getCurrentPeriod } = await import('./services/accountingEngine.js')
    await seedChartOfAccounts()
    await getCurrentPeriod()
    console.log('Accounting initialized: chart of accounts seeded, fiscal period ready')
  } catch (err) {
    console.error('Accounting init failed (non-fatal):', err.message)
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  initAccounting()
  startBackupScheduler()
  startAttendanceCron()
})

export default app
