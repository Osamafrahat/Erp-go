import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { useCartStore } from '../../stores/cartStore'
import { useUserStore, PERMISSIONS } from '../../stores/userStore'
import { useOfflineStore } from '../../stores/offlineStore'
import { languageNames } from '../../lib/translations'
import { Button } from '@heroui/react'
import {
  ShoppingCart,
  Package,
  BarChart3,
  Truck,
  Tag,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Store,
  Globe,
  Users,
  LogOut,
  LayoutDashboard,
  UserCheck,
  Receipt,
  RotateCcw,
  Activity,
  BookOpen,
  FileText,
  DollarSign,
  Scale,
  ChevronDown,
  WifiOff,
  RefreshCw,
  HardDrive,
  Clock,
  Calendar,
  Briefcase,
  Award,
  Wrench,
  CreditCard,
  Crown,
  Sparkles,
  Shield,
   Banknote,
   ClipboardList,
   AlertTriangle,
} from 'lucide-react'
import ChatWidget from '../ChatWidget'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme, sidebarOpen, toggleSidebar, language, setLanguage, t, settings } = useAppStore()
  const { getItemCount } = useCartStore()
  const { currentUser, logout, canAccess, hasPermission, subscriptionTier, subscriptionStatus, trialEndsAt, isTrial } = useUserStore()
  const { isOnline, pendingCount, lastSyncTime, isSyncing, syncProgress, init: initOffline, syncPendingOrders, retryFailed } = useOfflineStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showSyncPanel, setShowSyncPanel] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Initialize offline store
  useEffect(() => {
    initOffline()
  }, [initOffline])

  // Close sync panel on outside click
  useEffect(() => {
    if (!showSyncPanel) return
    const handler = (e) => {
      if (!e.target.closest('[data-sync-panel]')) {
        setShowSyncPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSyncPanel])

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  // Build grouped navigation based on Odoo classification
  const groups = []

  // -- Dashboard --
  groups.push({
    key: 'dashboard',
    items: [
      { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    ]
  })

  // -- Point of Sale --
  if (canAccess('/pos')) {
    groups.push({
      key: 'pos',
      items: [
        { name: t('nav.pos'), href: '/pos', icon: ShoppingCart },
      ]
    })
  }

  // -- Sales --
  const salesItems = []
  if (canAccess('/customers')) {
    salesItems.push({ name: t('nav.customers') || 'Customers', href: '/customers', icon: UserCheck })
  }
  if (canAccess('/promotions')) {
    salesItems.push({ name: t('nav.promotions'), href: '/promotions', icon: Tag })
  }
  if (canAccess('/refunds')) {
    salesItems.push({ name: t('nav.refunds') || 'Refunds', href: '/refunds', icon: RotateCcw })
  }
  if (canAccess('/credit-sales') && currentUser?.role !== 'SUPER_ADMIN') {
    salesItems.push({ name: t('nav.creditSales') || 'Credit Sales', href: '/credit-sales', icon: Banknote })
  }
  if (canAccess('/cash-shifts') && currentUser?.role !== 'SUPER_ADMIN') {
    salesItems.push({ name: t('nav.cashShifts') || 'Cash Box', href: '/cash-shifts', icon: Banknote })
  }
  if (currentUser?.role !== 'SUPER_ADMIN') {
    salesItems.push({ name: t('nav.invoices') || 'Invoices', href: '/invoices', icon: FileText })
  }
  if (salesItems.length > 0) {
    groups.push({ key: 'sales', label: t('nav.groupSales') || 'Sales', items: salesItems })
  }

  // -- Services --
  const serviceItems = []
  if (canAccess('/services')) {
    serviceItems.push({ name: t('nav.services') || 'Services', href: '/services', icon: Wrench })
    serviceItems.push({ name: t('nav.servicePlans') || 'Plans', href: '/service-plans', icon: CreditCard })
    serviceItems.push({ name: t('nav.subscriptions') || 'Subscriptions', href: '/subscriptions', icon: RefreshCw })
  }
  if (serviceItems.length > 0) {
    groups.push({ key: 'services', label: t('nav.groupServices') || 'Services', items: serviceItems })
  }

  // -- Inventory --
  const inventoryItems = []
  if (canAccess('/inventory')) {
    inventoryItems.push({ name: t('nav.inventory'), href: '/inventory', icon: Package })
  }
  if (canAccess('/suppliers')) {
    inventoryItems.push({ name: t('nav.suppliers'), href: '/suppliers', icon: Truck })
  }
  if (canAccess('/purchase-orders') && currentUser?.role !== 'SUPER_ADMIN') {
    inventoryItems.push({ name: t('nav.purchaseOrders') || 'Purchase Orders', href: '/purchase-orders', icon: ClipboardList })
  }
  if (inventoryItems.length > 0) {
    groups.push({ key: 'inventory', label: t('nav.groupInventory') || 'Inventory', items: inventoryItems })
  }

  // -- Accounting --
  const accountingItems = []
  if (hasPermission(PERMISSIONS.ACCOUNTING_VIEW)) {
    accountingItems.push({ name: t('nav.chartOfAccounts') || 'Chart of Accounts', href: '/accounting/accounts', icon: BookOpen })
    accountingItems.push({ name: t('nav.journalEntries') || 'Journal Entries', href: '/accounting/journals', icon: FileText })
    accountingItems.push({ name: t('nav.payments') || 'Payments', href: '/accounting/payments', icon: DollarSign })
    accountingItems.push({ name: t('nav.financialReports') || 'Financial Reports', href: '/accounting/reports', icon: Scale })
  }
  if (canAccess('/expenses')) {
    accountingItems.push({ name: t('nav.expenses') || 'Expenses', href: '/expenses', icon: Receipt })
  }
  if (accountingItems.length > 0) {
    groups.push({ key: 'accounting', label: t('nav.groupAccounting') || 'Accounting', items: accountingItems })
  }

  // -- HR (Permission-based: hr_view or hr_edit) --
  const hrItems = []
  if (hasPermission(PERMISSIONS.HR_VIEW) || hasPermission(PERMISSIONS.HR_EDIT)) {
    hrItems.push({ name: t('nav.employees') || 'Employees', href: '/employees', icon: Users })
    hrItems.push({ name: t('nav.attendance') || 'Attendance', href: '/hr/attendance', icon: Clock })
    hrItems.push({ name: t('nav.attendanceDashboard') || 'Attendance Dashboard', href: '/hr/attendance-dashboard', icon: BarChart3 })
    if (currentUser?.role !== 'SUPER_ADMIN') {
      hrItems.push({ name: t('nav.leave') || 'Leave', href: '/hr/leave', icon: Calendar })
    }
    hrItems.push({ name: t('nav.payroll') || 'Payroll', href: '/hr/payroll', icon: DollarSign })
    if (currentUser?.role !== 'SUPER_ADMIN') {
      hrItems.push({ name: t('nav.shifts') || 'Shifts', href: '/hr/shifts', icon: Briefcase })
    }
    hrItems.push({ name: t('nav.performance') || 'Performance', href: '/hr/performance', icon: Award })
    if (canAccess('/commissions')) {
      hrItems.push({ name: t('nav.commissions') || 'Commissions', href: '/commissions', icon: DollarSign })
    }
  } else if (canAccess('/hr/shifts/view') || canAccess('/hr/leave/request')) {
    // Non-managers with basic HR access: shifts view (read-only) + leave request
    if (currentUser?.role !== 'SUPER_ADMIN') {
      hrItems.push({ name: t('nav.shifts') || 'Shifts', href: '/hr/shifts/view', icon: Briefcase })
      hrItems.push({ name: t('nav.leave') || 'Leave', href: '/hr/leave/request', icon: Calendar })
    }
  }
  if (hrItems.length > 0) {
    groups.push({ key: 'hr', label: t('nav.groupHR') || 'HR', items: hrItems })
  }

  // -- Reporting --
  if (canAccess('/reports')) {
    const reportingItems = [
      { name: t('nav.reports'), href: '/reports', icon: BarChart3 },
    ]
    if (canAccess('/dead-stock')) {
      reportingItems.push({ name: t('nav.deadStock') || 'Dead Stock', href: '/dead-stock', icon: AlertTriangle })
    }
    groups.push({
      key: 'reporting',
      label: t('nav.groupReporting') || 'Reporting',
      items: reportingItems,
    })
  }

  // -- Settings (Permission-based: settings_view, settings_edit, user_manage) --
  const settingsItems = []
  if (canAccess('/users')) {
    settingsItems.push({ name: t('nav.users') || 'Users', href: '/users', icon: Users })
  }
  if (canAccess('/activities')) {
    settingsItems.push({ name: t('nav.activities') || 'Activity Log', href: '/activities', icon: Activity })
  }
  if (canAccess('/backup')) {
    settingsItems.push({ name: t('nav.backup') || 'Backup', href: '/backup', icon: HardDrive })
  }
  if (canAccess('/settings')) {
    settingsItems.push({ name: t('nav.settings'), href: '/settings', icon: Settings })
  }
  if (settingsItems.length > 0) {
    groups.push({ key: 'settings', label: t('nav.groupSettings') || 'Settings', items: settingsItems })
  }

  // -- Subscription --
  const subscriptionItems = []
  if (currentUser?.role === 'SUPER_ADMIN') {
    subscriptionItems.push({ name: t('layout.superAdmin') || 'Super Admin', href: '/super-admin', icon: Shield })
  } else {
    if (subscriptionTier === 'free') {
      subscriptionItems.push({ name: t('layout.upgrade') || 'Upgrade', href: '/pricing', icon: Crown })
    }
    if (currentUser?.role === 'MANAGER') {
      subscriptionItems.push({ name: t('layout.billing') || 'Billing', href: '/billing', icon: CreditCard })
    }
  }
  if (subscriptionItems.length > 0) {
    groups.push({ key: 'subscription', label: t('layout.groupSubscription') || 'Subscription', items: subscriptionItems })
  }

  const handleLogout = () => {
    if (loggingOut) return
    setLoggingOut(true)
    logout()
    navigate('/login')
  }

  return (
    <div className={`flex h-screen overflow-hidden ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? 'w-64' : 'w-[72px]'}
          bg-surface-secondary border-e border-border
          transition-all duration-300 ease-in-out
          hidden md:flex flex-col
        `}
      >
        {/* Logo */}
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-4 border-b border-border`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 overflow-hidden">
                {settings.storeLogo ? (
                  <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-5 h-5 text-accent-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-foreground text-base block leading-tight truncate">{settings.storeName || t('layout.defaultStoreName')}</span>
                <span className="text-[10px] text-muted uppercase tracking-wider">POS System</span>
              </div>
            </div>
          ) : (
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center hover:opacity-90 transition-all duration-200 overflow-hidden"
              title={t('layout.expandSidebar') || 'Expand sidebar'}
            >
              {settings.storeLogo ? (
                <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-5 h-5 text-accent-foreground" />
              )}
            </button>
          )}
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-all duration-200 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {groups.map((group) => {
            // Single-item groups (Dashboard, POS) render directly
            if (!group.label) {
              const item = group.items[0]
              const isActive = location.pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={!sidebarOpen ? item.name : undefined}
                  className={`
                    group relative flex items-center gap-3 rounded-xl transition-all duration-200
                    ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}
                    ${isActive
                      ? 'bg-accent-soft text-accent-soft-foreground'
                      : 'text-muted hover:text-foreground hover:bg-surface-hover'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-e-full" />
                  )}
                  <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  {sidebarOpen && (
                    <span className="font-medium text-sm">{item.name}</span>
                  )}
                  {item.href === '/pos' && getItemCount() > 0 && (
                    <span className={`
                      bg-accent text-accent-foreground text-[10px] font-bold rounded-full
                      ${sidebarOpen ? 'ml-auto px-2 py-0.5' : 'absolute -top-1 -right-1 px-1 py-0.5 min-w-[18px] text-center'}
                    `}>
                      {getItemCount()}
                    </span>
                  )}
                </Link>
              )
            }

            // Multi-item groups with header
            const isExpanded = expandedGroups[group.key] !== false // default open
            const hasActive = group.items.some(i => location.pathname === i.href)

            return (
              <div key={group.key} className="space-y-0.5">
                {sidebarOpen && (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={`flex items-center justify-between w-full px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold transition-colors ${
                      hasActive ? 'text-accent' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>
                )}
                {(!sidebarOpen || isExpanded) && group.items.map((item) => {
                  const isActive = location.pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={!sidebarOpen ? item.name : undefined}
                      className={`
                        group relative flex items-center gap-3 rounded-xl transition-all duration-200
                        ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}
                        ${isActive
                          ? 'bg-accent-soft text-accent-soft-foreground'
                          : 'text-muted hover:text-foreground hover:bg-surface-hover'
                        }
                      `}
                    >
                      {isActive && (
                        <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-e-full" />
                      )}
                      <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                      {sidebarOpen && (
                        <span className="font-medium text-sm">{item.name}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-border space-y-2">
          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className={`flex items-center gap-3 w-full rounded-xl text-muted hover:text-foreground hover:bg-surface-hover transition-all duration-200 ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}`}
            >
              <Globe className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="font-medium text-sm">{t('nav.language')}</span>
                  <span className="ml-auto text-xs bg-surface-hover px-2 py-0.5 rounded-md">{languageNames[language]}</span>
                </>
              )}
            </button>
            {showLanguageMenu && sidebarOpen && (
              <div className="absolute bottom-full left-0 w-full mb-1 bg-overlay border border-border rounded-xl shadow-xl overflow-hidden z-50">
                {Object.entries(languageNames).map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setLanguage(code)
                      setShowLanguageMenu(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center justify-between transition-colors ${
                      language === code ? 'text-accent bg-accent-soft' : 'text-foreground'
                    }`}
                  >
                    <span>{name}</span>
                    {language === code && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-3 w-full rounded-xl text-muted hover:text-foreground hover:bg-surface-hover transition-all duration-200 ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}`}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Sun className="w-5 h-5 flex-shrink-0" />
            )}
            {sidebarOpen && <span className="font-medium text-sm">{theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}</span>}
          </button>

          {/* User Info & Logout */}
          <div className="border-t border-border pt-2">
            {sidebarOpen && currentUser && (
              <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl hover:bg-surface-hover transition-all duration-200 group">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 transition-transform">
                  <span className="text-accent-foreground font-bold text-sm">{currentUser.fullName?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">{currentUser.fullName}</p>
                  <p className="text-[11px] text-accent capitalize">{currentUser.role?.toLowerCase()}</p>
                </div>
              </Link>
            )}
            {!sidebarOpen && currentUser && (
              <Link to="/profile" className="flex justify-center py-1" title={currentUser.fullName}>
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center transition-transform">
                  <span className="text-accent-foreground font-bold text-sm">{currentUser.fullName?.charAt(0)?.toUpperCase()}</span>
                </div>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full rounded-xl text-danger/80 hover:text-danger hover:bg-danger-soft transition-all duration-200 ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}`}
              title={!sidebarOpen ? t('users.signOut') : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium text-sm">{t('users.signOut')}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className={`fixed top-0 h-full w-72 bg-surface-secondary border-e border-border shadow-xl flex flex-col overflow-hidden ${language === 'ar' ? 'right-0' : 'left-0'}`}>
            {/* Mobile Logo */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center overflow-hidden">
                  {settings.storeLogo ? (
                    <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-5 h-5 text-accent-foreground" />
                  )}
                </div>
                <div>
                  <span className="font-bold text-foreground text-base block leading-tight">{settings.storeName || t('layout.defaultStoreName')}</span>
                  <span className="text-[10px] text-muted uppercase tracking-wider">POS System</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {groups.map((group) => {
                if (!group.label) {
                  const item = group.items[0]
                  const isActive = location.pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                        ${isActive
                          ? 'bg-accent-soft text-accent-soft-foreground'
                          : 'text-muted hover:text-foreground hover:bg-surface-hover'
                        }
                      `}
                    >
                      {isActive && (
                        <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-e-full" />
                      )}
                      <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                      <span className="font-medium text-sm">{item.name}</span>
                    </Link>
                  )
                }

                return (
                  <div key={group.key} className="space-y-0.5">
                    <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`
                            group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                            ${isActive
                              ? 'bg-accent-soft text-accent-soft-foreground'
                              : 'text-muted hover:text-foreground hover:bg-surface-hover'
                            }
                          `}
                        >
                          {isActive && (
                            <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-e-full" />
                          )}
                          <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                          <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </nav>

            {/* Mobile Bottom */}
            <div className="p-3 border-t border-border space-y-2">
              {/* Language Switcher */}
              <div className="flex items-center gap-2 px-2">
                <Globe className="w-4 h-4 text-muted flex-shrink-0" />
                {Object.entries(languageNames).map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setLanguage(code)
                      setMobileMenuOpen(false)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      language === code
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-surface-hover text-muted hover:text-foreground'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>

              {/* Mobile User Info */}
              {currentUser && (
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                    <span className="text-accent-foreground font-bold text-sm">{currentUser.fullName?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{currentUser.fullName}</p>
                    <p className="text-[11px] text-accent capitalize">{currentUser.role?.toLowerCase()}</p>
                  </div>
                </div>
              )}

              {/* Mobile Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-danger/80 hover:text-danger hover:bg-danger-soft transition-all duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium text-sm">{t('users.signOut')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Header */}
        {/* z-30: backdrop-blur forms a stacking context, so dropdowns here (z-50) are
            trapped below page content such as BannerCarousel's `relative z-10`.
            Must stay < 50 or the mobile drawer (z-50, earlier sibling) would be covered. */}
        <header className="z-30 bg-background/80 backdrop-blur-sm border-b border-border px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className="md:hidden"
              aria-label="Open menu"
              onPress={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-base sm:text-xl font-bold text-foreground truncate min-w-0 flex-1">
              {(() => {
                for (const group of groups) {
                  const found = group.items.find(i => i.href === location.pathname)
                  if (found) return found.name
                }
                return settings.storeName || t('layout.defaultStoreName')
              })()}
            </h1>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Offline Indicator */}
              <div className="relative" data-sync-panel>
                <button
                  onClick={() => setShowSyncPanel(!showSyncPanel)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isOnline
                      ? pendingCount > 0
                        ? 'bg-warning-soft text-warning-foreground hover:bg-warning-soft/80'
                        : 'bg-success-soft text-success-foreground'
                      : 'bg-danger-soft text-danger-foreground'
                  }`}
                >
                  {isOnline ? (
                    pendingCount > 0 ? <RefreshCw className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-success" />
                  ) : (
                    <WifiOff className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isOnline ? (pendingCount > 0 ? `${pendingCount} ${t('offline.pending')}` : t('offline.online')) : t('offline.offline')}
                  </span>
                </button>

                {/* Sync Panel Dropdown */}
                {showSyncPanel && (
                  <div className="absolute end-0 top-full mt-2 w-72 bg-overlay border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-foreground">{t('offline.syncStatus')}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isOnline ? 'bg-success-soft text-success-foreground' : 'bg-danger-soft text-danger-foreground'}`}>
                          {isOnline ? t('offline.online') : t('offline.offline')}
                        </span>
                      </div>

                      <div className="text-xs text-muted space-y-1">
                        {lastSyncTime && (
                          <p>{t('offline.lastSync')}: {new Date(lastSyncTime).toLocaleString()}</p>
                        )}
                        {pendingCount > 0 && (
                          <p className="text-warning-foreground font-medium">
                            {pendingCount} {t('offline.ordersWaiting')}
                          </p>
                        )}
                        {isSyncing && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{t('offline.syncing')}</span>
                              <span>{syncProgress.done}/{syncProgress.total}</span>
                            </div>
                            <div className="w-full bg-surface-tertiary rounded-full h-1.5">
                              <div
                                className="bg-accent h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${syncProgress.total > 0 ? (syncProgress.done / syncProgress.total) * 100 : 0}%` }}
                              />
                            </div>
                            {syncProgress.errors > 0 && (
                              <p className="text-danger mt-1">{syncProgress.errors} {t('offline.errors')}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {isOnline && pendingCount > 0 && !isSyncing && (
                          <Button
                            variant="primary"
                            size="sm"
                            fullWidth
                            onPress={syncPendingOrders}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {t('offline.syncNow')}
                          </Button>
                        )}
                        {!isOnline && (
                          <div className="flex-1 px-3 py-2 bg-surface-secondary rounded-lg text-sm text-center text-muted">
                            {t('offline.waitingConnection')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Subscription Badge */}
              {currentUser?.role !== 'SUPER_ADMIN' && (() => {
                const trialDaysLeft = isTrial() ? Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)) : 0
                if (isTrial()) {
                  return (
                    <Link to="/billing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-warning-soft text-warning-foreground hover:bg-warning-soft/80 transition-all duration-200">
                      <Sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('layout.trialBadge') || 'Trial'} ({trialDaysLeft}d left)</span>
                    </Link>
                  )
                }
                if (subscriptionTier === 'pro') {
                  return (
                    <Link to="/billing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-success-soft text-success-foreground hover:bg-success-soft/80 transition-all duration-200">
                      <Crown className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('layout.proBadge') || 'Pro'}</span>
                    </Link>
                  )
                }
                if (subscriptionTier === 'enterprise') {
                  return (
                    <Link to="/billing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent-soft text-accent-foreground hover:bg-accent-soft/80 transition-all duration-200">
                      <Crown className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('layout.enterpriseBadge') || 'Enterprise'}</span>
                    </Link>
                  )
                }
                return (
                  <Link to="/pricing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-secondary text-muted hover:bg-surface-hover transition-all duration-200">
                    <span className="hidden sm:inline">{t('layout.freeBadge') || 'Free'}</span>
                    <span className="hidden sm:inline text-accent font-semibold">{t('layout.upgrade') || 'Upgrade'}</span>
                  </Link>
                )
              })()}

              {/* Mobile Language Switcher */}
              <div className="relative md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  aria-label="Change language"
                  onPress={() => setShowLanguageMenu(!showLanguageMenu)}
                >
                  <Globe className="w-5 h-5" />
                </Button>
                {showLanguageMenu && (
                  <div className="absolute end-0 top-full mt-1 bg-overlay border border-border rounded-xl shadow-xl overflow-hidden z-50">
                    {Object.entries(languageNames).map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => {
                          setLanguage(code)
                          setShowLanguageMenu(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-surface-hover flex items-center justify-between text-sm ${
                          language === code ? 'text-accent bg-accent-soft' : 'text-foreground'
                        }`}
                      >
                        <span>{name}</span>
                        {language === code && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className="md:hidden"
                aria-label="Toggle theme"
                onPress={toggleTheme}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-2 sm:p-4">
          {children}
        </main>
      </div>
      {currentUser?.role !== 'SUPER_ADMIN' && <ChatWidget />}
    </div>
  )
}
