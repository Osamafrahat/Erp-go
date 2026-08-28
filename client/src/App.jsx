import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './stores/appStore'
import { useUserStore } from './stores/userStore'
import Layout from './components/layout/Layout'
import Toast from './components/Toast'
import SessionTimeout from './components/SessionTimeout'
import ForcePasswordChange from './components/ForcePasswordChange'
import ErrorBoundary from './components/ErrorBoundary'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const POSPage = lazy(() => import('./pages/POSPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'))
const PromotionsPage = lazy(() => import('./pages/PromotionsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const RefundsPage = lazy(() => import('./pages/RefundsPage'))
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ChartOfAccountsPage = lazy(() => import('./pages/ChartOfAccountsPage'))
const JournalEntriesPage = lazy(() => import('./pages/JournalEntriesPage'))
const AccountingReportsPage = lazy(() => import('./pages/AccountingReportsPage'))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))
const BackupPage = lazy(() => import('./pages/BackupPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const AttendanceDashboard = lazy(() => import('./pages/AttendanceDashboard'))
const LeavePage = lazy(() => import('./pages/LeavePage'))
const LeaveRequestPage = lazy(() => import('./pages/LeaveRequestPage'))
const PayrollPage = lazy(() => import('./pages/PayrollPage'))
const ShiftSchedulingPage = lazy(() => import('./pages/ShiftSchedulingPage'))
const PerformanceReviewsPage = lazy(() => import('./pages/PerformanceReviewsPage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const ServicePlansPage = lazy(() => import('./pages/ServicePlansPage'))
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))

function ProtectedRoute({ children }) {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  )
}

function App() {
  const theme = useAppStore((s) => s.theme)
  const settings = useAppStore((s) => s.settings)
  const loadSettings = useAppStore((s) => s.loadSettings)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const mustChangePassword = useUserStore((s) => s.mustChangePassword)
  const refreshUser = useUserStore((s) => s.refreshUser)

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings()
      refreshUser()
    }
  }, [isAuthenticated, loadSettings, refreshUser])

  useEffect(() => {
    document.title = settings.storeName || 'Store POS'
  }, [settings.storeName])

  const showForcePasswordChange = isAuthenticated && mustChangePassword()

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Router>
          <ErrorBoundary>
            <Toast />
            <SessionTimeout />
          </ErrorBoundary>

          {showForcePasswordChange && (
            <ForcePasswordChange />
          )}

          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={
                  isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
                } />
                <Route path="/signup" element={
                  isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />
                } />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/billing" element={<ProtectedRoute><Layout><BillingPage /></Layout></ProtectedRoute>} />
                <Route path="/super-admin" element={<ProtectedRoute><Layout><SuperAdminPage /></Layout></ProtectedRoute>} />

                <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
                <Route path="/pos" element={<ProtectedRoute><Layout><POSPage /></Layout></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Layout><InventoryPage /></Layout></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Layout><ReportsPage /></Layout></ProtectedRoute>} />
                <Route path="/suppliers" element={<ProtectedRoute><Layout><SuppliersPage /></Layout></ProtectedRoute>} />
                <Route path="/promotions" element={<ProtectedRoute><Layout><PromotionsPage /></Layout></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><Layout><UsersPage /></Layout></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Layout><CustomersPage /></Layout></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute><Layout><EmployeesPage /></Layout></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute><Layout><ExpensesPage /></Layout></ProtectedRoute>} />
                <Route path="/refunds" element={<ProtectedRoute><Layout><RefundsPage /></Layout></ProtectedRoute>} />
                <Route path="/activities" element={<ProtectedRoute><Layout><ActivitiesPage /></Layout></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
                <Route path="/accounting/accounts" element={<ProtectedRoute><Layout><ChartOfAccountsPage /></Layout></ProtectedRoute>} />
                <Route path="/accounting/journals" element={<ProtectedRoute><Layout><JournalEntriesPage /></Layout></ProtectedRoute>} />
                <Route path="/accounting/reports" element={<ProtectedRoute><Layout><AccountingReportsPage /></Layout></ProtectedRoute>} />
                <Route path="/accounting/payments" element={<ProtectedRoute><Layout><PaymentsPage /></Layout></ProtectedRoute>} />
                <Route path="/invoices" element={<ProtectedRoute><Layout><InvoicesPage /></Layout></ProtectedRoute>} />
                <Route path="/backup" element={<ProtectedRoute><Layout><BackupPage /></Layout></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Layout><ChatPage /></Layout></ProtectedRoute>} />
                <Route path="/hr/attendance" element={<ProtectedRoute><Layout><AttendancePage /></Layout></ProtectedRoute>} />
                <Route path="/hr/attendance-dashboard" element={<ProtectedRoute><Layout><AttendanceDashboard /></Layout></ProtectedRoute>} />
                <Route path="/hr/leave" element={<ProtectedRoute><Layout><LeavePage /></Layout></ProtectedRoute>} />
                <Route path="/hr/leave/request" element={<ProtectedRoute><Layout><LeaveRequestPage /></Layout></ProtectedRoute>} />
                <Route path="/hr/payroll" element={<ProtectedRoute><Layout><PayrollPage /></Layout></ProtectedRoute>} />
                <Route path="/hr/shifts" element={<ProtectedRoute><Layout><ShiftSchedulingPage /></Layout></ProtectedRoute>} />
                <Route path="/hr/shifts/view" element={<ProtectedRoute><Layout><ShiftSchedulingPage readOnly /></Layout></ProtectedRoute>} />
                <Route path="/hr/performance" element={<ProtectedRoute><Layout><PerformanceReviewsPage /></Layout></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute><Layout><ServicesPage /></Layout></ProtectedRoute>} />
                <Route path="/service-plans" element={<ProtectedRoute><Layout><ServicePlansPage /></Layout></ProtectedRoute>} />
                <Route path="/subscriptions" element={<ProtectedRoute><Layout><SubscriptionsPage /></Layout></ProtectedRoute>} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </div>
    </div>
  )
}

export default App
