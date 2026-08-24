# Store Management - Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- Git

## Database Setup (One File)

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Open **Supabase SQL Editor**
3. Copy the entire contents of `server/supabase-schema.sql` and run it
   - This creates all **24 tables**, indexes, RLS policies, admin user, **21 chart of accounts**, and default settings
   - Single file — no separate migrations needed
4. Get your Supabase credentials from **Project Settings > API**
5. Create `.env` file in `server/` directory:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=3001
   JWT_SECRET=your_random_secret_key
   RESEND_API_KEY=your_resend_api_key
   ```

## Start the Application

### Option 1: Start both (if root package.json has dev script)
```bash
cd store-management
npm run dev
```

### Option 2: Start separately

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

## Access
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api

## Default Login
- **Username:** `admin`
- **Password:** `admin123`
- You will be forced to change the password on first login

## Default Settings
| Setting | Value |
|---------|-------|
| Currency | EGP (ج.م) |
| Tax Rate | 14% VAT |
| Low Stock Threshold | 10 units |

## Feature Quick Guide

### POS (Point of Sale)
1. Go to **POS** page
2. Search products or use barcode scanner
3. Add items to cart, adjust quantities
4. Apply promo codes (optional)
5. Click **Proceed to Payment**
6. Select payment method (Cash/Card/Mobile) — supports split payments
7. Complete sale — receipt prints in new window

### Inventory
1. Go to **Inventory** page
2. Add products with name, SKU, barcode, price, cost, supplier
3. Manage categories
4. Track stock levels, receive stock from suppliers

### Invoices
1. Go to **Invoices** page (under Sales in sidebar)
2. View all orders with status (Paid/Refunded)
3. Search, filter, and print receipts

### Suppliers
1. Go to **Suppliers** page
2. Add suppliers — each gets a unique AP account automatically
3. View remaining balance owed to each supplier

### Refunds
1. Go to **Refunds** page
2. Click **Process Refund**
3. Search by order number
4. Choose **Refund Full Order** or **Select Specific Items**
5. For item selection: check items, adjust quantities
6. VAT and promo discounts are calculated proportionally
7. Submit — stock restored automatically

### Accounting
1. Go to **Chart of Accounts** — view/edit 21 default accounts, create custom ones
2. Go to **Journal Entries** — view all auto-posted entries
3. Go to **Accounting Reports** — Trial Balance, Balance Sheet, Profit & Loss
4. All orders, refunds, expenses, and stock receives auto-post to journal

### Reports
1. Go to **Reports** page
2. **Sales** tab — daily/weekly/monthly sales data
3. **Stock** tab — inventory value with total cost and potential profit
4. **Expenses** tab — expense breakdown by category
5. **P&L** tab — profit and loss statement

### Settings
1. Go to **Settings** page
2. Upload **store logo** (PNG/JPG/SVG, max 512KB) — appears in sidebar and login
3. Configure store name, address, phone
4. Adjust tax rate and currency
5. Customize receipt footer

### Offline Mode
- Products and settings are cached in IndexedDB automatically
- If you go offline, orders are queued locally
- When back online, pending orders sync automatically
- Header shows online/offline indicator with pending order count

## Reset Data

To clear all data and start fresh:
1. Run `server/reset-all-data.sql` in Supabase SQL Editor
2. This truncates all transactional data and re-seeds settings & chart of accounts
3. Users are preserved

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Server won't start | Check port 3001, run `npm install`, verify `.env` |
| Frontend can't connect | Ensure server running on 3001, check CORS |
| Database issues | Verify Supabase credentials, re-run `supabase-schema.sql` |
| Build fails | Run `cd client && npx vite build` to see error |
| Deploy not updating | Hard-refresh browser (Ctrl+Shift+R) |
| Admin password lost | Run `fix-admin.sql` or re-run `supabase-schema.sql` |

## Project Structure
```
store-management/
├── client/          # React frontend (20 pages, 15 components)
├── server/          # Node.js backend (21 routes, 3 services)
├── server/supabase-schema.sql   # Complete DB schema (one file)
├── server/reset-all-data.sql    # Reset data script
├── README.md        # Full documentation
└── QUICKSTART.md    # This file
```
