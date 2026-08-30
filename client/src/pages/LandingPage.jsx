import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import {
  ShoppingCart, Package, Users, BarChart3, UserCheck, Layers,
  Check, ArrowRight, Zap, Shield, Globe, Star, Store,
  CreditCard, Clock, Headphones, ArrowUpRight, Sparkles,
  Database, MessageCircle
} from 'lucide-react'

function FeatureCard({ icon: Icon, title, desc, color, gradient }) {
  return (
    <div className="group relative bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 hover:border-primary-300 dark:hover:border-primary-600/50 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-500 hover:-translate-y-1">
      <div className={`absolute inset-0 rounded-2xl ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function StepCard({ num, icon: Icon, title, desc }) {
  return (
    <div className="relative group">
      <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/10 to-emerald-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
      <div className="relative bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/25 group-hover:scale-110 transition-transform duration-500">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div className="text-xs font-bold text-primary-600 dark:text-primary-400 mb-2 tracking-wider uppercase">{num}</div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { t, language, setLanguage } = useAppStore()
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const [openModal, setOpenModal] = useState(null)

  const features = [
    { icon: ShoppingCart, title: t('landing.pos') || 'Point of Sale', desc: t('landing.posDesc') || 'Fast checkout with receipt printing, multiple payment methods, and real-time inventory updates.', color: 'bg-primary-600', gradient: 'bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/10 dark:to-transparent' },
    { icon: Package, title: t('landing.inventory') || 'Inventory Management', desc: t('landing.inventoryDesc') || 'Track stock levels, set low-stock alerts, manage suppliers, and monitor product movements.', color: 'bg-emerald-600', gradient: 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/10 dark:to-transparent' },
    { icon: Users, title: t('landing.employees') || 'Employee Management', desc: t('landing.employeesDesc') || 'Manage attendance, shift scheduling, payroll, performance reviews, and leave requests.', color: 'bg-violet-600', gradient: 'bg-gradient-to-br from-violet-50 to-white dark:from-violet-900/10 dark:to-transparent' },
    { icon: BarChart3, title: t('landing.reports') || 'Financial Reports', desc: t('landing.reportsDesc') || 'Sales reports, expense tracking, profit & loss statements, and accounting integration.', color: 'bg-amber-600', gradient: 'bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/10 dark:to-transparent' },
    { icon: UserCheck, title: t('landing.customers') || 'Customer Management', desc: t('landing.customersDesc') || 'Customer profiles, purchase history, CRM tools, and invoice management.', color: 'bg-rose-600', gradient: 'bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/10 dark:to-transparent' },
    { icon: Headphones, title: t('landing.support') || '24/7 Technical Support', desc: t('landing.supportDesc') || 'Expert help anytime via WhatsApp, email, or live chat. We\'re always here for you.', color: 'bg-cyan-600', gradient: 'bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-900/10 dark:to-transparent' },
    { icon: Zap, title: t('landing.upgrades') || 'Easy Plan Upgrades', desc: t('landing.upgradesDesc') || 'Start free, upgrade when you grow. Flexible plans with instant activation and no downtime.', color: 'bg-teal-600', gradient: 'bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/10 dark:to-transparent' },
    { icon: Database, title: t('landing.backup') || 'Automatic Backups', desc: t('landing.backupDesc') || 'Your data is safely backed up automatically. Restore anytime with one click.', color: 'bg-indigo-600', gradient: 'bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-transparent' },
    { icon: MessageCircle, title: t('landing.chat') || 'Live Chat Support', desc: t('landing.chatDesc') || 'Get instant answers through built-in live chat. Talk to your team directly from the app.', color: 'bg-pink-600', gradient: 'bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/10 dark:to-transparent' },
  ]

  const steps = [
    { icon: Store, title: t('landing.step1Title') || 'Create Your Store', desc: t('landing.step1Desc') || 'Sign up in seconds. No credit card required. Get started with a free plan instantly.' },
    { icon: Package, title: t('landing.step2Title') || 'Add Your Products', desc: t('landing.step2Desc') || 'Import your inventory or add products one by one. Set prices, stock levels, and categories.' },
    { icon: ShoppingCart, title: t('landing.step3Title') || 'Start Selling', desc: t('landing.step3Desc') || 'Process sales in seconds with our lightning-fast POS. Accept cash, cards, or digital wallets.' },
    { icon: BarChart3, title: t('landing.step4Title') || 'Track Everything', desc: t('landing.step4Desc') || 'Monitor sales, expenses, inventory, and employee performance in real-time dashboards.' },
  ]

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen bg-white dark:bg-gray-900 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <img src="/erpgologo.svg" alt="ERP-GO" className="h-12 w-auto" />
              <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">{t('landing.brand') || 'ERP-GO'}</span>
            </div>
            <div className="hidden md:flex items-center gap-7">
              <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('landing.features') || 'Features'}</a>
              <a href="#how" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('landing.howItWorks') || 'How It Works'}</a>
              <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('users.signIn') || 'Login'}</Link>
              <button
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-all"
              >
                <Globe className="w-4 h-4" />
                {language === 'en' ? 'عربي' : 'EN'}
              </button>
              <Link to={isAuthenticated ? '/dashboard' : '/login'} className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-xl hover:from-primary-700 hover:to-primary-800 shadow-lg shadow-primary-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/30">
                {t('landing.startFree') || 'Start Free Trial'}
              </Link>
            </div>
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <Globe className="w-3.5 h-3.5" />
                {language === 'en' ? 'عربي' : 'EN'}
              </button>
              <Link to={isAuthenticated ? '/dashboard' : '/login'} className="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary-500/25">
                {t('landing.startFree') || 'Start'}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/80 via-white to-emerald-50/60 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-300/20 dark:bg-primary-700/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-emerald-300/15 dark:bg-emerald-700/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary-400/10 to-emerald-400/10 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-36 lg:py-44">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <img src="/erpgologo.svg" alt="ERP-GO" className="h-32 w-auto" />
            </div>
            <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-primary-700 dark:text-primary-300 text-sm font-semibold px-5 py-2 rounded-full mb-8 border border-primary-200/50 dark:border-primary-700/50 shadow-sm">
              <Sparkles className="w-4 h-4" />
              {t('landing.badge') || 'All-in-one store management'}
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-8">
              {t('landing.heroTitle') || 'Complete Store'}{' '}
              <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-emerald-500 bg-clip-text text-transparent">
                {t('landing.heroTitle2') || 'Management System'}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              {t('landing.heroSubtitle') || 'Professional POS, inventory, HR, and accounting — all in one platform. Manage your store from anywhere.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-10 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-lg font-bold rounded-2xl hover:from-primary-700 hover:to-primary-800 shadow-xl shadow-primary-500/25 transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
              >
                {t('landing.startFree') || 'Start Free Trial'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 sm:py-32 bg-gray-50/50 dark:bg-gray-800/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              {t('landing.features') || 'Features'}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">{t('landing.featuresTitle') || 'Everything You Need to Run Your Store'}</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('landing.featuresSubtitle') || 'One platform to manage sales, inventory, employees, finances, and customers.'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              {t('landing.howItWorks') || 'How It Works'}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">{t('landing.howTitle') || 'Up and Running in Minutes'}</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('landing.howSubtitle') || 'No complex setup. No training needed. Start managing your store today.'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => <StepCard key={i} num={`0${i + 1}`} {...s} />)}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-24 sm:py-32 bg-gray-50/50 dark:bg-gray-800/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wider">
                <Star className="w-3.5 h-3.5" />
                {t('landing.whyUs') || 'Why ERP-GO'}
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">{t('landing.whyTitle') || 'Built for Successful Store Owners'}</h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">{t('landing.whySubtitle') || "We understand the challenges of running a store. That's why we built a system that handles the complexity so you can focus on growth."}</p>
              <div className="space-y-5">
                {[
                  { icon: Zap, text: t('landing.why1') || 'Lightning-fast POS — process a sale in seconds', color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' },
                  { icon: Shield, text: t('landing.why2') || 'Secure multi-users architecture with role-based access', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
                  { icon: Globe, text: t('landing.why3') || 'Bilingual support (English & Arabic) out of the box', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
                  { icon: Star, text: t('landing.why4') || 'Real-time analytics and customizable reports', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="text-gray-600 dark:text-gray-300 pt-2">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary-500/20">
                <img
                  src="https://images.unsplash.com/photo-1590736969955-71cc94901144?w=600&h=700&fit=crop"
                  alt="Store cashier using POS system"
                  className="w-full h-80 sm:h-96 object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/20 via-emerald-500/20 to-primary-500/20 rounded-3xl blur-3xl" />
            <div className="relative bg-gradient-to-r from-primary-600 via-primary-500 to-emerald-500 rounded-3xl p-12 sm:p-20 text-white overflow-hidden shadow-2xl shadow-primary-500/20">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
                  <CreditCard className="w-4 h-4" />
                  {t('landing.ctaBadge') || 'Free to start'}
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">{t('landing.ctaTitle') || 'Ready to Manage Your Store?'}</h2>
                <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">{t('landing.ctaSubtitle') || 'Start your free trial today. No credit card required.'}</p>
                <Link
                  to={isAuthenticated ? '/dashboard' : '/login'}
                  className="inline-flex items-center gap-2.5 px-10 py-4 bg-white text-primary-600 text-lg font-bold rounded-2xl hover:bg-gray-100 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                >
                  {t('landing.startFree') || 'Start Free Trial'}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/erpgologo.svg" alt="ERP-GO" className="h-10 w-auto" />
                <span className="font-extrabold text-gray-900 dark:text-white tracking-tight">{t('landing.brand') || 'ERP-GO'}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t('landing.footerDesc') || 'Professional store management for modern businesses.'}</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">{t('landing.footerProduct') || 'Product'}</h4>
              <ul className="space-y-2.5 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="#features" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('landing.features') || 'Features'}</a></li>
                <li><a href="#how" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('landing.howItWorks') || 'How It Works'}</a></li>
                <li><Link to="/login" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('users.signIn') || 'Login'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">{t('landing.footerSupport') || 'Support'}</h4>
              <ul className="space-y-2.5 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="https://wa.me/201555256213" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">WhatsApp</a></li>
                <li><a href="mailto:support.erp.go@gmail.com" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Email</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">{t('landing.footerLegal') || 'Legal'}</h4>
              <ul className="space-y-2.5 text-sm text-gray-500 dark:text-gray-400">
                <li><button onClick={() => setOpenModal('privacy')} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left">{t('landing.footerPrivacy') || 'Privacy Policy'}</button></li>
                <li><button onClick={() => setOpenModal('terms')} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left">{t('landing.footerTerms') || 'Terms of Service'}</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} {t('landing.brand') || 'ERP-GO'}. {t('landing.footerRights') || 'All rights reserved.'}
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {openModal === 'privacy' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpenModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</h2>
              <button onClick={() => setOpenModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">✕</button>
            </div>
            <div className="px-6 py-6 space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {language === 'ar' ? (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">المعلومات التي نجمعها</h3>
                    <p>نقوم بجمع المعلومات التالية عند إنشاء حسابك واستخدام المنصة:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>الاسم واسم المتجر وعنوان البريد الإلكتروني</li>
                      <li>بيانات المعاملات المالية (المبيعات، المصروفات، الفواتير)</li>
                      <li>معلومات الموظفين والعملاء التي تدخلها في النظام</li>
                      <li>عنوان IP ومعلومات الجهاز لأغراض الأمان</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">كيف نستخدم معلوماتك</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>تشغيل وتحسين خدمات المنصة</li>
                      <li>إرسال إشعارات متعلقة بحسابك واشتراكك</li>
                      <li>حماية حسابك ومنع الوصول غير المصرح به</li>
                      <li>الامتثال للمتطلبات القانونية</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">أمن البيانات</h3>
                    <p>نستخدم تشفير SSL/TLS لحماية بياناتك. بياناتك محفوظة بشكل آمن في بنية Supabase السحابية مع عزل كامل لكل مستأجر.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">حقوقك</h3>
                    <p>يحق لك الوصول إلى بياناتك وتصديرها وحذفها في أي وقت. يمكنك طلب حذف حسابك بالكامل من خلال الدعم الفني.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">التواصل</h3>
                    <p>لأي استفسارات حول سياسة الخصوصية، تواصل معنا عبر البريد الإلكتروني: support.erp.go@gmail.com</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Information We Collect</h3>
                    <p>We collect the following information when you create your account and use the platform:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>Your name, store name, and email address</li>
                      <li>Financial transaction data (sales, expenses, invoices)</li>
                      <li>Employee and customer information you enter into the system</li>
                      <li>IP address and device information for security purposes</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">How We Use Your Information</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>To operate and improve platform services</li>
                      <li>To send notifications related to your account and subscription</li>
                      <li>To protect your account and prevent unauthorized access</li>
                      <li>To comply with legal requirements</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Data Security</h3>
                    <p>We use SSL/TLS encryption to protect your data. Your data is securely stored in Supabase cloud infrastructure with full tenant isolation.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your Rights</h3>
                    <p>You have the right to access, export, and delete your data at any time. You can request full account deletion through our support team.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Contact</h3>
                    <p>For any questions about this Privacy Policy, contact us at: support.erp.go@gmail.com</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {openModal === 'terms' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpenModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'شروط الخدمة' : 'Terms of Service'}</h2>
              <button onClick={() => setOpenModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">✕</button>
            </div>
            <div className="px-6 py-6 space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {language === 'ar' ? (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">القبول بالشروط</h3>
                    <p>باستخدام منصة ERP-GO، أنت توافق على هذه الشروط. إذا لم توافق، يرجى عدم استخدام المنصة.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">الحسابات والاشتراكات</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>يجب أن يكون عمرك 18 سنة أو أكثر لإنشاء حساب</li>
                      <li>أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول</li>
                      <li>الخطط المجانية لها حدود استخدام محددة</li>
                      <li>يمكنك إلغاء اشتراكك في أي وقت من لوحة التحكم</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">المحتوى والبيانات</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>أنت تمتلك كل البيانات التي تدخلها في النظام</li>
                      <li>نحن لا نبيع أو نشارك بياناتك مع أطراف ثالثة</li>
                      <li>يجب عليك الامتثال للقوانين المحلية عند استخدام المنصة</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">الإلغاء والاسترداد</h3>
                    <p>يمكنك إلغاء اشتراكك في أي وقت. لا يتم تقديم استرداد للمبالغ المدفوعة للفترة الحالية. سيبقى حسابك نشطاً حتى نهاية فترة الفوترة الحالية.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">المسؤولية</h3>
                    <p>المنصة مقدمة "كما هي" دون ضمانات. نحن لسنا مسؤولين عن أي خسائر الناتجة عن استخدام المنصة.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Acceptance of Terms</h3>
                    <p>By using ERP-GO, you agree to these terms. If you do not agree, please do not use the platform.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Accounts & Subscriptions</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>You must be 18 or older to create an account</li>
                      <li>You are responsible for maintaining the confidentiality of your login credentials</li>
                      <li>Free plans have specific usage limits</li>
                      <li>You can cancel your subscription at any time from the dashboard</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Content & Data</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>You own all data you enter into the system</li>
                      <li>We do not sell or share your data with third parties</li>
                      <li>You must comply with local laws when using the platform</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Cancellation & Refunds</h3>
                    <p>You may cancel your subscription at any time. No refunds are provided for the current billing period. Your account will remain active until the end of the current billing period.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Limitation of Liability</h3>
                    <p>The platform is provided "as is" without warranties. We are not liable for any losses resulting from platform use.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
