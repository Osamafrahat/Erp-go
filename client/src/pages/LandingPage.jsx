import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import {
  ShoppingCart, Package, Users, BarChart3, UserCheck, Layers,
  Check, ArrowRight, Zap, Shield, Globe, Star, ChevronRight, Store
} from 'lucide-react'

function FeatureCard({ icon: Icon, title, desc, color }) {
  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-lg transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function PricingCard({ name, price, period, desc, features, cta, highlighted, ctaLink }) {
  return (
    <div className={`relative rounded-2xl p-8 border-2 transition-all duration-300 ${
      highlighted
        ? 'border-primary-500 bg-white dark:bg-gray-800 shadow-xl shadow-primary-500/10 scale-105'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300'
    }`}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-4 py-1 rounded-full">
          Most Popular
        </div>
      )}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{name}</h3>
      <div className="mb-4">
        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{price}</span>
        <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">{period}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{desc}</p>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Check className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to={ctaLink}
        className={`block w-full text-center py-3 rounded-xl font-semibold transition-colors ${
          highlighted
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

export default function LandingPage() {
  const { t } = useAppStore()
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)

  const features = [
    { icon: ShoppingCart, title: t('landing.pos') || 'Point of Sale', desc: t('landing.posDesc') || 'Fast checkout with receipt printing, multiple payment methods, and real-time inventory updates.', color: 'bg-primary-600' },
    { icon: Package, title: t('landing.inventory') || 'Inventory Management', desc: t('landing.inventoryDesc') || 'Track stock levels, set low-stock alerts, manage suppliers, and monitor product movements.', color: 'bg-emerald-600' },
    { icon: Users, title: t('landing.employees') || 'Employee Management', desc: t('landing.employeesDesc') || 'Manage attendance, shift scheduling, payroll, performance reviews, and leave requests.', color: 'bg-violet-600' },
    { icon: BarChart3, title: t('landing.reports') || 'Financial Reports', desc: t('landing.reportsDesc') || 'Sales reports, expense tracking, profit & loss statements, and accounting integration.', color: 'bg-amber-600' },
    { icon: UserCheck, title: t('landing.customers') || 'Customer Management', desc: t('landing.customersDesc') || 'Customer profiles, purchase history, CRM tools, and invoice management.', color: 'bg-rose-600' },
    { icon: Layers, title: t('landing.saas') || 'Multi-Tenant SaaS', desc: t('landing.saasDesc') || 'Self-service signup, subscription billing, and isolated tenant data with role-based access.', color: 'bg-cyan-600' },
  ]

  const freeFeatures = [
    t('landing.freeF1') || 'Up to 50 products',
    t('landing.freeF2') || '2 team members',
    t('landing.freeF3') || '100 orders/month',
    t('landing.freeF4') || 'Basic POS & inventory',
    t('landing.freeF5') || 'Email support',
  ]

  const proFeatures = [
    t('landing.proF1') || 'Up to 500 products',
    t('landing.proF2') || '15 team members',
    t('landing.proF3') || 'Unlimited orders',
    t('landing.proF4') || 'Advanced reports & accounting',
    t('landing.proF5') || 'Priority support',
  ]

  const enterpriseFeatures = [
    t('landing.entF1') || 'Unlimited products',
    t('landing.entF2') || 'Unlimited team members',
    t('landing.entF3') || 'Unlimited orders',
    t('landing.entF4') || 'Full HR, payroll & accounting',
    t('landing.entF5') || 'Dedicated support',
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">{t('landing.brand') || 'ERP-GO'}</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('landing.features') || 'Features'}</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('landing.pricing') || 'Pricing'}</a>
              <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{t('users.signIn') || 'Login'}</Link>
              <Link to={isAuthenticated ? '/dashboard' : '/login'} className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors">
                {t('landing.startFree') || 'Start Free Trial'}
              </Link>
            </div>
            <div className="md:hidden">
              <Link to={isAuthenticated ? '/dashboard' : '/login'} className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors">
                {t('landing.startFree') || 'Start'}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200/30 dark:bg-primary-800/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-800/10 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Zap className="w-4 h-4" />
              {t('landing.badge') || 'All-in-one store management'}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight mb-6">
              {t('landing.heroTitle') || 'Complete Store'} <br />
              <span className="bg-gradient-to-r from-primary-600 to-emerald-500 bg-clip-text text-transparent">
                {t('landing.heroTitle2') || 'Management System'}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('landing.heroSubtitle') || 'Professional POS, inventory, HR, and accounting — all in one platform. Manage your store from anywhere.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-2xl hover:bg-primary-700 shadow-lg shadow-primary-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/30"
              >
                {t('landing.startFree') || 'Start Free Trial'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-lg font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all"
              >
                {t('landing.viewPricing') || 'View Pricing'}
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-gray-400 dark:text-gray-500">
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" />{t('landing.freeForever') || 'Free forever plan'}</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" />{t('landing.noCard') || 'No credit card required'}</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" />{t('landing.cancelAnytime') || 'Cancel anytime'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">{t('landing.featuresTitle') || 'Everything You Need to Run Your Store'}</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('landing.featuresSubtitle') || 'One platform to manage sales, inventory, employees, finances, and customers.'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-6">{t('landing.whyTitle') || 'Built for Real Store Owners'}</h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">{t('landing.whySubtitle') || 'We understand the challenges of running a store. That\'s why we built a system that handles the complexity so you can focus on growth.'}</p>
              <div className="space-y-4">
                {[
                  { icon: Zap, text: t('landing.why1') || 'Lightning-fast POS — process a sale in seconds' },
                  { icon: Shield, text: t('landing.why2') || 'Secure multi-tenant architecture with role-based access' },
                  { icon: Globe, text: t('landing.why3') || 'Bilingual support (English & Arabic) out of the box' },
                  { icon: Star, text: t('landing.why4') || 'Real-time analytics and customizable reports' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="text-gray-600 dark:text-gray-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-primary-500 to-emerald-500 rounded-3xl p-8 sm:p-12 text-white">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: t('landing.stat1Label') || 'Active Stores', value: '500+' },
                    { label: t('landing.stat2Label') || 'Orders Processed', value: '100K+' },
                    { label: t('landing.stat3Label') || 'Uptime', value: '99.9%' },
                    { label: t('landing.stat4Label') || 'Countries', value: '10+' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/10 rounded-2xl p-5 text-center">
                      <div className="text-3xl font-extrabold mb-1">{s.value}</div>
                      <div className="text-sm text-white/70">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary-200 dark:bg-primary-800/30 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">{t('landing.pricingTitle') || 'Simple, Transparent Pricing'}</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('landing.pricingSubtitle') || 'Start free, upgrade when you need more. No hidden fees.'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
            <PricingCard
              name="Free"
              price="0 EGP"
              period={t('landing.perMonth') || '/month'}
              desc={t('landing.freeDesc') || 'Perfect for small stores just getting started.'}
              features={freeFeatures}
              cta={t('landing.getStarted') || 'Get Started'}
              ctaLink={isAuthenticated ? '/dashboard' : '/signup'}
            />
            <PricingCard
              name="Pro"
              price="599 EGP"
              period={t('landing.perMonth') || '/month'}
              desc={t('landing.proDesc') || 'For growing stores that need more power.'}
              features={proFeatures}
              cta={t('landing.startTrial') || 'Start Trial'}
              highlighted
              ctaLink={isAuthenticated ? '/dashboard' : '/signup'}
            />
            <PricingCard
              name="Enterprise"
              price="1,499 EGP"
              period={t('landing.perMonth') || '/month'}
              desc={t('landing.entDesc') || 'For large operations with advanced needs.'}
              features={enterpriseFeatures}
              cta={t('landing.contactSales') || 'Contact Sales'}
              ctaLink={isAuthenticated ? '/dashboard' : '/signup'}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-primary-600 to-emerald-500 rounded-3xl p-12 sm:p-16 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{t('landing.ctaTitle') || 'Ready to Manage Your Store?'}</h2>
              <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">{t('landing.ctaSubtitle') || 'Start your free trial today. No credit card required.'}</p>
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 text-lg font-semibold rounded-2xl hover:bg-gray-100 transition-colors shadow-lg"
              >
                {t('landing.startFree') || 'Start Free Trial'}
                <ArrowRight className="w-5 h-5" />
              </Link>
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
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Store className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{t('landing.brand') || 'ERP-GO'}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('landing.footerDesc') || 'Professional store management for modern businesses.'}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('landing.footerProduct') || 'Product'}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="#features" className="hover:text-primary-600 transition-colors">{t('landing.features') || 'Features'}</a></li>
                <li><a href="#pricing" className="hover:text-primary-600 transition-colors">{t('landing.pricing') || 'Pricing'}</a></li>
                <li><Link to="/login" className="hover:text-primary-600 transition-colors">{t('users.signIn') || 'Login'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('landing.footerSupport') || 'Support'}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="https://wa.me/201555256213" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors">WhatsApp</a></li>
                <li><a href="mailto:support.erp.go@gmail.com" className="hover:text-primary-600 transition-colors">Email</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('landing.footerLegal') || 'Legal'}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><span>{t('landing.footerPrivacy') || 'Privacy Policy'}</span></li>
                <li><span>{t('landing.footerTerms') || 'Terms of Service'}</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} {t('landing.brand') || 'ERP-GO'}. {t('landing.footerRights') || 'All rights reserved.'}
          </div>
        </div>
      </footer>
    </div>
  )
}
