# Store Management - POS & Stock System

A full-stack retail store management application with Point of Sale (POS), Inventory/Stock management, Accounting, HR, Services/Subscriptions, and Reporting features. Supports English and Arabic with full RTL layout. Includes offline POS support and PWA installability.

## Features

### POS (Point of Sale)
- Product grid with search, category filtering, and barcode scanning
- Continuous barcode scanner mode with scan counter and green flash feedback
- Quick product add to cart with quantity adjustment
- Multiple payment methods (Cash, Card, Bank Transfer)
- Split payments support
- Promo code application with discount calculation
- Receipt generation and printing (new-window print)
- Cart persists across sessions
- Browser zoom-safe layout (cart stays visible at any zoom level)
- **3 tabs:** Products (with VAT), Services (one-time, no VAT), Subscriptions (plan-based, no VAT)
- **Offline POS**: IndexedDB caching of products, categories, customers, settings; orders queued locally when offline and synced automatically when back online

### Stock/Inventory Management
- Full product catalog with CRUD operations (name, SKU, barcode, price, cost, stock)
- Supplier assignment per product
- Stock tracking with quantity management
- Stock receive with supplier selection (auto-posts AP journal)
- Stock adjustments
- Low stock alerts and notifications
- Category management with Arabic/English support
- Bulk inventory print report (GARD / جرد) — one-click A4 print layout

### Supplier Management
- Supplier directory with contact info (name, phone, email, address)
- **Per-supplier AP tracking** — each supplier gets a unique Accounts Payable account (e.g., `2010-S1`)
- **Remaining balance display** on each supplier card (what you owe them)
- Link suppliers to products
- Activity logging on all CRUD operations

### Customer Management
- Customer directory with purchase history
- Customer selection during POS checkout
- Loyalty points tracking

### Promotions & Discounts
- Percentage and fixed-amount discounts
- Date-range validity with start/end dates
- Usage limits and per-customer limits
- Minimum purchase requirements
- WhatsApp promotion sending via Resend

### Refunds
- **Item-level refunds** — select specific items to refund, not just full order
- **Full order refund** — refund everything at once
- Automatic proportional VAT and promotion discount calculation on partial refunds
- Reason tracking per refund
- Automatic stock restoration (only for refunded items)
- Accounting journal auto-posted for refunds (including COGS/inventory reversal)
- Partial refund tracking (order can have multiple partial refunds until fully refunded)

### Expenses
- Expense tracking with categories (Rent, Utilities, Salaries, Supplies, Marketing, Other)
- Monthly expense overview with charts
- Accounting journal auto-posted per expense (category-aware account mapping)

### Invoices
- View all orders, service sales, and subscription payments in one place
- Search and filter by type (Products, Services, Subscriptions) and status
- Service orders marked with blue badge, subscriptions with purple badge
- Stats cards: Total Orders, Paid, Partial Refund, Refunded, Total Revenue, Service Sales, Subscription Revenue
- Print receipt for any order
- ETA (Egyptian Tax Authority) submission

### Services & Subscriptions
- **Services:** One-time paid services (Maintenance, Warranty, Custom) — no VAT
- **Subscription Plans:** Monthly, Annual, or One-time billing cycles
- **Customer Subscriptions:** Track active/past_due/expired status, renewal, payment history
- **POS Integration:** Sell services and subscriptions directly from POS
- **Duplicate subscription prevention:** 409 error if customer already has active subscription for same plan

### Full Accounting System (Double-Entry)
- **Chart of Accounts** — 18 default accounts (Assets, Liabilities, Equity, Revenue, Expenses). Custom accounts supported. Per-supplier AP accounts auto-created.
- **Journal Entries** — Double-entry bookkeeping with multi-line entries. Debit/credit validation, auto-balancing, reversal support.
- **Payments** — Inbound (customer payments) and outbound (supplier/expense payments). Auto-generates journal entries.
- **Auto-Posting Engine** — Orders, refunds, expenses, stock receives, services, subscriptions, and product lifecycle events automatically generate balanced journal entries.
  - **Orders (Products):** Debit AR (1030), Credit Sales (4010), Credit VAT (2030), Debit COGS (5010), Credit Inventory (1050)
  - **Orders (Services):** Debit Cash/AR, Credit Service Revenue (4015)
  - **Subscriptions:** Debit Cash/AR, Credit Subscription Revenue (4025)
  - **Payments:** Debit Cash/Bank (1010/1020), Credit AR (1030) — separate journal per payment split
  - **Refunds:** Debit Sales Returns (4020), Credit Cash (1010), Debit Inventory (1050), Credit COGS (5010) — item-level cost lookup
  - **Expenses:** Debit Expense Account (5020-5050), Credit Cash (1010) — category-aware mapping
  - **Stock Receive:** Debit Inventory (1050), Credit Supplier AP (2010-Sx) — per-supplier tracking
- **Financial Reports** (4 tabs):
  - Trial Balance
  - Balance Sheet
  - Profit & Loss Statement
  - Fiscal Period management (open/close periods)
  - Account Ledger with date filtering
- **Set Initial Capital** — record opening equity balance
- **Recalculate Balances** — recompute all account balances from journal entries
- **Print Reports** — clean print window for inventory, accounting reports in A4 layout
- **Permissions:** `ACCOUNTING_VIEW`, `ACCOUNTING_EDIT`, `ACCOUNTING_POST`

### HR / Employees
- Employee directory with roles, contact info, salary
- Link employees to system users
- Activity logging

### HR / Attendance
- Self-service clock in/out with geolocation verification
- Break tracking (start/end with automatic minutes calculation)
- Late detection with configurable grace period
- Overtime calculation
- Auto clock-out via cron job
- Daily and per-employee attendance dashboard

### HR / Leave Management
- Configurable leave types (Annual, Sick, Personal, etc.)
- Leave request submission with approval workflow
- Leave balance tracking per employee
- Auto-creates attendance records for approved leave

### HR / Payroll
- Payroll runs with overtime calculation from attendance data
- Individual item payment tracking
- Employee-wise breakdown

### HR / Shifts
- Shift definitions (name, start/end time)
- Employee shift assignments (calendar view)
- Bulk weekly assignment

### HR / Performance Reviews
- Review creation with criteria and ratings
- Status tracking (draft, in-progress, completed)

### Team Chat
- Real-time messaging between team members
- Manager-only bulk delete

### Egyptian Tax Authority (ETA) Integration
- ETA receipt submission
- QR code generation for receipts
- Document status tracking

### Activity Log / Audit Trail
- Automatic logging of 25+ action types across all modules
- Tracks: created, updated, deleted, toggled_active, status changes, toggled_paid, refunds
- Filterable by entity type, action, date range
- Paginated table with user attribution
- Manager-only access control

### Role-Based Access Control (RBAC)
- **6 roles:** Manager, Sales Manager, Cashier, Inventory Clerk, Accountant, HR Manager
- **27 granular permissions:** `dashboard_view`, `pos_access`, `inventory_view/edit`, `reports_view`, `suppliers_view/edit`, `promotions_view/edit`, `settings_view/edit`, `user_manage`, `customers_view/edit`, `expenses_view/edit`, `refunds_view/edit`, `employees_view/edit`, `hr_view/edit`, `services_view/edit`, `accounting_view/edit/post`
- Role-based dashboard — each role sees only relevant widgets and stats
- Manager has full access to all features

### Force Password Change
- New users (created by admin) are forced to change password on first login
- Profile page password change logs out user after saving
- Modal blocks entire UI until password is changed

### Session Timeout
- Automatic session expiry after configurable inactivity period
- Session timeout handler redirects to login

### User Profile
- Read-only user data display (name, username, role, status, last login, member since)
- Editable phone and email fields
- Change password functionality with logout after save

### Reports & Analytics
- Sales reports (daily, weekly, monthly, yearly)
- Top selling products
- Stock value reports with total cost and potential profit
- Low stock alerts
- Expense reports with daily breakdown
- Profit & Loss report
- Sales trend charts (Recharts)
- Role-based dashboard visibility

### Settings
- **Store logo upload** — PNG/JPG/SVG (max 512KB), displayed in sidebar, login page, and collapsed sidebar
- Store name, address, phone configuration
- Tax rate settings (default 14% VAT)
- Currency settings (default EGP / ج.م)
- Low stock threshold configuration
- Loyalty points per currency unit
- Receipt footer customization
- ETA (Egyptian Tax Authority) configuration
- Attendance settings (grace period, overtime threshold, geolocation)
- Settings stored in Supabase database (not localStorage)

### Bilingual Support
- Full English and Arabic translation (300+ keys)
- RTL layout support with `text-start`/`text-end` alignment
- Language preference persists in localStorage
- Arabic store name: متجرى

### Theme
- Dark mode and Light mode toggle
- Theme preference persists in localStorage
- Sidebar always dark gradient (regardless of theme)

### Offline & PWA
- **IndexedDB caching** for products, categories, customers, settings
- **Offline order queue** — orders created offline are synced when connection is restored
- **Sync panel** in header — shows online/offline status, pending orders count, sync progress
- **PWA manifest** — installable on mobile and desktop

## Tech Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS, Zustand v5, Recharts, Lucide React icons, idb (IndexedDB)
- **Backend:** Node.js, Express 5, bcryptjs, jsonwebtoken, node-cron
- **Database:** Supabase (PostgreSQL) with Row Level Security (37+ tables)
- **Email:** Resend API (primary), Nodemailer (fallback)
- **State Management:** Zustand with localStorage persistence
- **Offline Storage:** IndexedDB via `idb` library

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- Git

### Quick Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Osamafrahat/store-management.git
   cd store-management
   ```

2. **Create a Supabase project:**
   - Go to [supabase.com](https://supabase.com) and create a new project

3. **Run the database schema:**
   - Open `server/supabase-schema.sql` in Supabase SQL Editor and run it
   - This creates all 37+ tables, indexes, RLS policies, admin user, chart of accounts (18 accounts), and default settings

4. **Get Supabase credentials:**
   - Go to Project Settings > API
   - Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY`

5. **Create `.env` file in `server/` directory:**
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=3001
   JWT_SECRET=your_secret_key_here_min_32_chars
   RESEND_API_KEY=your_resend_api_key
   ```

6. **Install dependencies and start:**

   **Backend:**
   ```bash
   cd server
   npm install
   npm run dev
   ```

   **Frontend (new terminal):**
   ```bash
   cd client
   npm install
   npm run dev
   ```

7. **Open your browser:** `http://localhost:5173`

### Default Login
- **Username:** `admin`
- **Password:** `admin123`
- On first login, you will be forced to change the password

### Docker Setup

```bash
# Copy and edit environment file
cp .env.docker.example .env.docker
nano .env.docker  # Add your Supabase credentials and JWT_SECRET

# Start everything
docker compose up -d --build

# Access at http://localhost
```

### Render Deployment

The project includes `render.yaml` for Render deployment:

1. Push to GitHub
2. Create new Render Web Service → Deploy from GitHub repo
3. Render auto-detects `render.yaml` and builds the server
4. Add environment variables in Render dashboard
5. Deploy

Client can be deployed separately to Vercel (already has `vercel.json`).

### Reset Data (Optional)
- Run `reset_data.sql` in Supabase SQL Editor to clear all transactional data and re-seed settings and chart of accounts. Keeps users intact.

## Project Structure

```
store-management/
├── client/                          # React frontend
│   ├── public/
│   │   └── manifest.json            # PWA manifest
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── Layout.jsx       # App shell: sidebar, header, mobile nav
│   │   │   ├── inventory/
│   │   │   │   ├── CategoryManager.jsx
│   │   │   │   ├── InventoryPrintSheet.jsx
│   │   │   │   ├── ProductForm.jsx
│   │   │   │   └── ProductList.jsx
│   │   │   ├── pos/
│   │   │   │   ├── BarcodeScanner.jsx
│   │   │   │   ├── Cart.jsx
│   │   │   │   ├── PaymentModal.jsx
│   │   │   │   ├── ProductGrid.jsx
│   │   │   │   └── ReceiptModal.jsx
│   │   │   ├── notifications/
│   │   │   │   └── SendPromotionModal.jsx
│   │   │   ├── BarcodePrinter.jsx
│   │   │   ├── ConfirmModal.jsx
│   │   │   ├── ForcePasswordChange.jsx
│   │   │   ├── SessionTimeout.jsx
│   │   │   └── Toast.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── POSPage.jsx
│   │   │   ├── InventoryPage.jsx
│   │   │   ├── SuppliersPage.jsx
│   │   │   ├── CustomersPage.jsx
│   │   │   ├── EmployeesPage.jsx
│   │   │   ├── ExpensesPage.jsx
│   │   │   ├── PromotionsPage.jsx
│   │   │   ├── RefundsPage.jsx
│   │   │   ├── InvoicesPage.jsx
│   │   │   ├── UsersPage.jsx
│   │   │   ├── ActivitiesPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── ReportsPage.jsx
│   │   │   ├── ChartOfAccountsPage.jsx
│   │   │   ├── JournalEntriesPage.jsx
│   │   │   ├── PaymentsPage.jsx
│   │   │   ├── AccountingReportsPage.jsx
│   │   │   ├── ServicesPage.jsx
│   │   │   ├── ServicePlansPage.jsx
│   │   │   └── SubscriptionsPage.jsx
│   │   ├── stores/
│   │   │   ├── appStore.js
│   │   │   ├── userStore.js
│   │   │   ├── cartStore.js
│   │   │   ├── offlineStore.js
│   │   │   └── productStore.js
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   ├── offlineDB.js
│   │   │   ├── translations.js       # EN/AR (300+ keys)
│   │   │   └── utils.js
│   │   └── index.css
│   ├── Dockerfile                    # Multi-stage: build + nginx
│   ├── nginx.conf                    # SPA routing + API proxy
│   └── package.json
│
├── server/                          # Node.js backend
│   ├── src/
│   │   ├── routes/                   # 32 route modules
│   │   │   ├── auth.js
│   │   │   ├── products.js
│   │   │   ├── categories.js
│   │   │   ├── orders.js
│   │   │   ├── refunds.js
│   │   │   ├── expenses.js
│   │   │   ├── suppliers.js
│   │   │   ├── customers.js
│   │   │   ├── employees.js
│   │   │   ├── promotions.js
│   │   │   ├── users.js
│   │   │   ├── settings.js
│   │   │   ├── activities.js
│   │   │   ├── accounts.js
│   │   │   ├── journals.js
│   │   │   ├── payments.js
│   │   │   ├── accountingReports.js
│   │   │   ├── reports.js
│   │   │   ├── stock.js
│   │   │   ├── sync.js
│   │   │   ├── email.js
│   │   │   ├── chat.js
│   │   │   ├── attendance.js
│   │   │   ├── leave.js
│   │   │   ├── payroll.js
│   │   │   ├── shifts.js
│   │   │   ├── performance.js
│   │   │   ├── services.js
│   │   │   ├── servicePlans.js
│   │   │   ├── subscriptions.js
│   │   │   ├── eta.js
│   │   │   └── backup.js
│   │   ├── services/                 # 7 service modules
│   │   │   ├── accountingEngine.js
│   │   │   ├── emailService.js
│   │   │   ├── whatsappService.js
│   │   │   ├── etaService.js
│   │   │   ├── backupService.js
│   │   │   ├── backupScheduler.js
│   │   │   └── attendanceCron.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── activityLogger.js
│   │   │   └── errorHandler.js
│   │   └── db/
│   │       ├── supabase.js
│   │       └── seed.js
│   ├── migrations/                   # 8 SQL migration files
│   ├── supabase-schema.sql           # Complete schema (37+ tables)
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml                # Docker orchestration
├── render.yaml                      # Render deployment config
├── .env.docker.example               # Docker env template
├── reset_data.sql                    # Data reset script
├── README.md
├── QUICKSTART.md
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and receive JWT token
- `POST /api/auth/register` - Register new user
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update phone and email

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/barcode/:barcode` - Get product by barcode
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order by ID (with items, payments)
- `POST /api/orders` - Create order (background: stock, payments, accounting)

### Services
- `GET /api/services` - Get all services
- `POST /api/services` - Create service
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service

### Service Plans
- `GET /api/service-plans` - Get all plans
- `POST /api/service-plans` - Create plan
- `PUT /api/service-plans/:id` - Update plan
- `DELETE /api/service-plans/:id` - Delete plan

### Subscriptions
- `GET /api/subscriptions` - Get all subscriptions
- `GET /api/subscriptions/payments/all` - Get all subscription payments
- `POST /api/subscriptions/quick` - Quick subscription from POS
- `POST /api/subscriptions/:id/payments` - Record payment
- `PATCH /api/subscriptions/:id/cancel` - Cancel subscription
- `PATCH /api/subscriptions/:id/renew` - Renew subscription

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/self-clock-out` - Clock out
- `POST /api/attendance/break-start` - Start break
- `POST /api/attendance/break-end` - End break
- `GET /api/attendance/dashboard` - Attendance dashboard

### Leave
- `GET /api/leave/types` - Get leave types
- `GET /api/leave/requests` - Get leave requests
- `POST /api/leave/requests` - Submit leave request
- `PATCH /api/leave/requests/:id/approve` - Approve/reject request

### Payroll
- `GET /api/payroll` - Get payroll runs
- `POST /api/payroll` - Create payroll run
- `PATCH /api/payroll/:id/pay` - Mark as paid

### Shifts
- `GET /api/shifts` - Get shifts
- `POST /api/shifts/assignments` - Assign shift
- `POST /api/shifts/assignments/bulk` - Bulk assign shifts

### Chat
- `GET /api/chat` - Get messages
- `POST /api/chat` - Send message

### ETA (Egyptian Tax Authority)
- `POST /api/eta/submit` - Submit order to ETA
- `GET /api/eta/status/:etaUUID` - Check submission status
- `POST /api/eta/qr` - Generate QR code

### Backup
- `GET /api/backup` - List backups
- `POST /api/backup/json` - Create JSON backup
- `POST /api/backup/sql` - Create SQL backup
- `GET /api/backup/download/:filename` - Download backup
- `POST /api/backup/restore` - Restore from backup

### Accounting
- `GET /api/accounting/accounts` - Chart of accounts
- `GET /api/accounting/journals` - Journal entries
- `GET /api/accounting/reports/trial-balance` - Trial balance
- `GET /api/accounting/reports/balance-sheet` - Balance sheet
- `GET /api/accounting/reports/profit-loss` - Profit & loss

### Other
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/stock` - Stock report
- `GET /api/settings` - Get settings (auth required)
- `PUT /api/settings` - Update settings
- `GET /api/activities` - Activity log
- `POST /api/sync/order` - Sync offline order

## Database

- **Schema file:** `server/supabase-schema.sql` — consolidated schema with all 37+ tables
- **Reset file:** `reset_data.sql` — clears transactional data, re-seeds settings & accounts
- **37+ tables:** users, categories, suppliers, products, customers, employees, orders, order_items, payment_splits, stock_movements, promotions, store_settings, expenses, refunds, refund_items, activity_log, accounts, fiscal_periods, journal_entries, journal_entry_lines, payments, account_balances, messages, attendance, leave_types, leave_requests, leave_balances, payroll, payroll_items, shifts, employee_shifts, performance_reviews, review_criteria, services, service_plans, subscriptions, subscription_payments
- **18 chart of accounts:** 1010-5050 (Assets, Liabilities, Equity, Revenue, Expenses)
- **62+ indexes** for query performance
- **RLS enabled** on all tables

## Default Settings

- **Store Name:** My Store (configurable via Settings)
- **Currency:** EGP (ج.م)
- **Tax Rate:** 14% VAT
- **Low Stock Threshold:** 10 units

## License
