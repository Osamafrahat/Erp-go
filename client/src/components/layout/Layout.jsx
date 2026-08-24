import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { useCartStore } from '../../stores/cartStore'
import { useUserStore, PERMISSIONS } from '../../stores/userStore'
import { useOfflineStore } from '../../stores/offlineStore'
import { languageNames } from '../../lib/translations'
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
} from 'lucide-react'
import ChatWidget from '../ChatWidget'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme, sidebarOpen, toggleSidebar, language, setLanguage, t, settings } = useAppStore()
  const { getItemCount } = useCartStore()
  const { currentUser, logout, canAccess, hasPermission } = useUserStore()
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
      { name: t('nav.dashboard'), href: '/', icon: LayoutDashboard },
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
  salesItems.push({ name: t('nav.invoices') || 'Invoices', href: '/invoices', icon: FileText })
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
    hrItems.push({ name: t('nav.leave') || 'Leave', href: '/hr/leave', icon: Calendar })
    hrItems.push({ name: t('nav.payroll') || 'Payroll', href: '/hr/payroll', icon: DollarSign })
    hrItems.push({ name: t('nav.shifts') || 'Shifts', href: '/hr/shifts', icon: Briefcase })
    hrItems.push({ name: t('nav.performance') || 'Performance', href: '/hr/performance', icon: Award })
  } else if (canAccess('/hr/shifts/view') || canAccess('/hr/leave/request')) {
    // Non-managers with basic HR access: shifts view (read-only) + leave request
    hrItems.push({ name: t('nav.shifts') || 'Shifts', href: '/hr/shifts/view', icon: Briefcase })
    hrItems.push({ name: t('nav.leave') || 'Leave', href: '/hr/leave/request', icon: Calendar })
  }
  if (hrItems.length > 0) {
    groups.push({ key: 'hr', label: t('nav.groupHR') || 'HR', items: hrItems })
  }

  // -- Reporting --
  if (canAccess('/reports')) {
    groups.push({
      key: 'reporting',
      label: t('nav.groupReporting') || 'Reporting',
      items: [
        { name: t('nav.reports'), href: '/reports', icon: BarChart3 },
      ]
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
          bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950
          transition-all duration-300 ease-in-out
          hidden md:flex flex-col
          shadow-2xl shadow-gray-900/50
        `}
      >
        {/* Logo */}
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-4 border-b border-white/10`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0 overflow-hidden">
                {settings.storeLogo ? (
                  <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-white text-base block leading-tight truncate">{settings.storeName || t('layout.defaultStoreName')}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">POS System</span>
              </div>
            </div>
          ) : (
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all duration-200 hover:scale-105 overflow-hidden"
              title="Expand sidebar"
            >
              {settings.storeLogo ? (
                <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-5 h-5 text-white" />
              )}
            </button>
          )}
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 flex-shrink-0"
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
                      ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-400 shadow-lg shadow-primary-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-primary-400 to-primary-600 rounded-e-full" />
                  )}
                  <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary-400' : ''}`} />
                  {sidebarOpen && (
                    <span className={`font-medium text-sm ${isActive ? 'text-primary-300' : ''}`}>{item.name}</span>
                  )}
                  {item.href === '/pos' && getItemCount() > 0 && (
                    <span className={`
                      bg-gradient-to-r from-primary-500 to-primary-600 text-white text-[10px] font-bold rounded-full shadow-lg shadow-primary-500/30
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
                      hasActive ? 'text-primary-400' : 'text-gray-500 hover:text-gray-300'
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
                          ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-400 shadow-lg shadow-primary-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      {isActive && (
                        <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-primary-400 to-primary-600 rounded-e-full" />
                      )}
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary-400' : ''}`} />
                      {sidebarOpen && (
                        <span className={`font-medium text-sm ${isActive ? 'text-primary-300' : ''}`}>{item.name}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-white/10 space-y-2">
          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className={`flex items-center gap-3 w-full rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}`}
            >
              <Globe className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="font-medium text-sm">{t('nav.language')}</span>
                  <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-md">{languageNames[language]}</span>
                </>
              )}
            </button>
            {showLanguageMenu && sidebarOpen && (
              <div className="absolute bottom-full left-0 w-full mb-1 bg-gray-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {Object.entries(languageNames).map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setLanguage(code)
                      setShowLanguageMenu(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between transition-colors ${
                      language === code ? 'text-primary-400 bg-primary-500/10' : 'text-gray-300'
                    }`}
                  >
                    <span>{name}</span>
                    {language === code && <span className="text-primary-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-3 w-full rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}`}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Sun className="w-5 h-5 flex-shrink-0" />
            )}
            {sidebarOpen && <span className="font-medium text-sm">{theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}</span>}
          </button>

          {/* User Info & Logout */}
          <div className="border-t border-white/10 pt-2">
            {sidebarOpen && currentUser && (
              <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl hover:bg-white/5 transition-all duration-200 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <span className="text-white font-bold text-sm">{currentUser.fullName?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate group-hover:text-primary-300 transition-colors">{currentUser.fullName}</p>
                  <p className="text-[11px] text-primary-400 capitalize">{currentUser.role?.toLowerCase()}</p>
                </div>
              </Link>
            )}
            {!sidebarOpen && currentUser && (
              <Link to="/profile" className="flex justify-center py-1" title={currentUser.fullName}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 hover:scale-105 transition-transform">
                  <span className="text-white font-bold text-sm">{currentUser.fullName?.charAt(0)?.toUpperCase()}</span>
                </div>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 ${sidebarOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}`}
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
          <aside className={`fixed top-0 h-full w-72 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 shadow-2xl flex flex-col overflow-hidden ${language === 'ar' ? 'right-0' : 'left-0'}`}>
            {/* Mobile Logo */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 overflow-hidden">
                  {settings.storeLogo ? (
                    <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <span className="font-bold text-white text-base block leading-tight">{settings.storeName || t('layout.defaultStoreName')}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">POS System</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
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
                          ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-400 shadow-lg shadow-primary-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      {isActive && (
                            <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-primary-400 to-primary-600 rounded-e-full" />
                      )}
                      <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary-400' : ''}`} />
                      <span className={`font-medium text-sm ${isActive ? 'text-primary-300' : ''}`}>{item.name}</span>
                    </Link>
                  )
                }

                return (
                  <div key={group.key} className="space-y-0.5">
                    <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-gray-500">
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
                              ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-400 shadow-lg shadow-primary-500/10'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                          `}
                        >
                          {isActive && (
                        <div className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-primary-400 to-primary-600 rounded-e-full" />
                          )}
                          <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary-400' : ''}`} />
                          <span className={`font-medium text-sm ${isActive ? 'text-primary-300' : ''}`}>{item.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </nav>

            {/* Mobile Bottom */}
            <div className="p-3 border-t border-white/10 space-y-2">
              {/* Language Switcher */}
              <div className="flex items-center gap-2 px-2">
                <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
                {Object.entries(languageNames).map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setLanguage(code)
                      setMobileMenuOpen(false)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      language === code
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/20'
                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>

              {/* Mobile User Info */}
              {currentUser && (
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 flex-shrink-0">
                    <span className="text-white font-bold text-sm">{currentUser.fullName?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{currentUser.fullName}</p>
                    <p className="text-[11px] text-primary-400 capitalize">{currentUser.role?.toLowerCase()}</p>
                  </div>
                </div>
              )}

              {/* Mobile Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{t('users.signOut')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700/50 px-3 sm:px-6 py-2 sm:py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent truncate min-w-0 flex-1">
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
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                >
                  {isOnline ? (
                    pendingCount > 0 ? <RefreshCw className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isOnline ? (pendingCount > 0 ? `${pendingCount} ${t('offline.pending')}` : t('offline.online')) : t('offline.offline')}
                  </span>
                </button>

                {/* Sync Panel Dropdown */}
                {showSyncPanel && (
                  <div className="absolute end-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm">{t('offline.syncStatus')}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isOnline ? t('offline.online') : t('offline.offline')}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        {lastSyncTime && (
                          <p>{t('offline.lastSync')}: {new Date(lastSyncTime).toLocaleString()}</p>
                        )}
                        {pendingCount > 0 && (
                          <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                            {pendingCount} {t('offline.ordersWaiting')}
                          </p>
                        )}
                        {isSyncing && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{t('offline.syncing')}</span>
                              <span>{syncProgress.done}/{syncProgress.total}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${syncProgress.total > 0 ? (syncProgress.done / syncProgress.total) * 100 : 0}%` }}
                              />
                            </div>
                            {syncProgress.errors > 0 && (
                              <p className="text-red-500 mt-1">{syncProgress.errors} {t('offline.errors')}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {isOnline && pendingCount > 0 && !isSyncing && (
                          <button
                            onClick={syncPendingOrders}
                            className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {t('offline.syncNow')}
                          </button>
                        )}
                        {!isOnline && (
                          <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-center text-gray-500">
                            {t('offline.waitingConnection')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Language Switcher */}
              <div className="relative md:hidden">
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                </button>
                {showLanguageMenu && (
                  <div className="absolute end-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                    {Object.entries(languageNames).map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => {
                          setLanguage(code)
                          setShowLanguageMenu(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between text-sm ${
                          language === code ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' : ''
                        }`}
                      >
                        <span>{name}</span>
                        {language === code && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors md:hidden"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-2 sm:p-4">
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}
