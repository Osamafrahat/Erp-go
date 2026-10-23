import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { LANDING_SEO } from '../lib/landingSeo'
import {
  ArrowRight,
  BarChart3,
  Database,
  Globe,
  Headphones,
  MessageCircle,
  Package,
  Shield,
  ShoppingCart,
  Star,
  Store,
  Timer,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react'

function FeatureCard({ icon: Icon, title, desc, color, gradient }) {
  return (
<div className="group relative bg-surface rounded-2xl p-6 border border-border hover:border-[#364fab]/40 hover:shadow-xl hover:shadow-[#364fab]/5 transition-all duration-500 hover:-translate-y-1">
      <div className={`absolute inset-0 rounded-2xl ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
<Icon className="w-6 h-6 text-white"/>
        </div>
<h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
<p className="text-sm text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function StepCard({ num, icon: Icon, title, desc }) {
  return (
    <div className="relative group">
<div className="absolute -inset-4 bg-gradient-to-r from-[#364fab]/10 to-[#ff4f00]/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"/>
<div className="relative bg-surface rounded-2xl p-6 border border-border text-center">
<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#364fab] to-[#ff4f00] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#364fab]/25 group-hover:scale-110 transition-transform duration-500">
<Icon className="w-7 h-7 text-white"/>
        </div>
<div className="text-xs font-bold text-[#364fab] mb-2 tracking-wider uppercase">{num}</div>
<h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
<p className="text-sm text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { t, language, setLanguage } = useAppStore()
  // SEO: keep document-level metadata in sync with the active language so the
  // Arabic variant ranks for Arabic queries (title/description/canonical/JSON-LD).
  useEffect(() => {
    const seo = LANDING_SEO[language] || LANDING_SEO.en
    document.documentElement.lang = seo.lang
    document.documentElement.dir = seo.lang === 'ar' ? 'rtl' : 'ltr'
    document.title = seo.title
    const setMeta = (selector, attr, value) => {
      const el = document.head.querySelector(selector)
      if (el) el.setAttribute(attr, value)
    }
    setMeta('meta[name="description"]', 'content', seo.description)
    setMeta('meta[name="keywords"]', 'content', seo.keywords)
    setMeta('meta[property="og:title"]', 'content', seo.title)
    setMeta('meta[property="og:description"]', 'content', seo.description)
    setMeta('meta[property="og:url"]', 'content', seo.canonical)
    setMeta('meta[property="og:locale"]', 'content', seo.ogLocale)
    setMeta('meta[name="twitter:title"]', 'content', seo.title)
    setMeta('meta[name="twitter:description"]', 'content', seo.description)
    setMeta('link[rel="canonical"]', 'href', seo.canonical)
    const ld = document.head.querySelector('script[type="application/ld+json"]')
    if (ld) {
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: seo.ldName,
        inLanguage: seo.lang,
        description: seo.ldDescription,
        url: seo.canonical,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EGP', description: 'Free plan available' },
        aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '150' },
      }, null, 2)
    }
  }, [language])
  // Keep the URL in step with the toggle so the AR variant stays crawlable
  // and shareable (/?lang=ar); LandingPage is the only SEO-indexed page.
  const toggleLanguage = () => {
    const next = language === 'en' ? 'ar' : 'en'
    setLanguage(next)
    const url = new URL(window.location.href)
    if (next === 'ar') url.searchParams.set('lang', 'ar')
    else url.searchParams.delete('lang')
    window.history.replaceState({}, '', url)
  }
  const [openModal, setOpenModal] = useState(null)
  // Tour video plays as a click-to-load lite embed: the animated mock and
  // play button stand in until the user opts in — no third-party iframe
  // (or YouTube request) happens on initial page load.
  const [playing, setPlaying] = useState(false)

  // Reveal-on-scroll: every .reveal element fades/slides in once it enters
  // the viewport. Falls back to "everything visible" without IntersectionObserver.
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'))
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const features = [
{icon: ShoppingCart,title: t('landing.pos')||'Point of Sale',desc: t('landing.posDesc')||'Fast checkout with receipt printing,multiple payment methods,and real-time inventory updates.',color:'bg-[#364fab]',gradient:'bg-gradient-to-br from-[#364fab]/10 to-white dark:from-[#364fab]/20 dark:to-transparent'},
{icon: Package,title: t('landing.inventory')||'Inventory Management',desc: t('landing.inventoryDesc')||'Track stock levels,set low-stock alerts,manage suppliers,and monitor product movements.',color:'bg-[#ff4f00]',gradient:'bg-gradient-to-br from-[#ff4f00]/10 to-white dark:from-[#ff4f00]/20 dark:to-transparent'},
    { icon: Users, title: t('landing.employees') || 'Employee Management', desc: t('landing.employeesDesc') || 'Manage attendance, shift scheduling, payroll, performance reviews, and leave requests.', color: 'bg-[#364fab]', gradient: 'bg-gradient-to-br from-[#364fab]/10 to-white dark:from-[#364fab]/20 dark:to-transparent' },
{icon: BarChart3,title: t('landing.reports')||'Financial Reports',desc: t('landing.reportsDesc')||'Sales reports,expense tracking,profit & loss statements,and accounting integration.',color:'bg-[#ff4f00]',gradient:'bg-gradient-to-br from-[#ff4f00]/10 to-white dark:from-[#ff4f00]/20 dark:to-transparent'},
    { icon: UserCheck, title: t('landing.customers') || 'Customer Management', desc: t('landing.customersDesc') || 'Customer profiles, purchase history, CRM tools, and invoice management. Send promotion notifications and manage loyalty points.', color: 'bg-[#364fab]', gradient: 'bg-gradient-to-br from-[#364fab]/10 to-white dark:from-[#364fab]/20 dark:to-transparent' },
{icon: Headphones,title: t('landing.support')||'24/7 Technical Support',desc: t('landing.supportDesc')||'Expert help anytime via WhatsApp,email,or live chat. We\'re always here for you.',color:'bg-[#ff4f00]',gradient:'bg-gradient-to-br from-[#ff4f00]/10 to-white dark:from-[#ff4f00]/20 dark:to-transparent'},
    { icon: Zap, title: t('landing.upgrades') || 'Easy Plan Upgrades', desc: t('landing.upgradesDesc') || 'Start free, upgrade when you grow. Flexible plans with instant activation and no downtime.', color: 'bg-[#364fab]', gradient: 'bg-gradient-to-br from-[#364fab]/10 to-white dark:from-[#364fab]/20 dark:to-transparent' },
{icon: Database,title: t('landing.backup')||'Automatic Backups',desc: t('landing.backupDesc')||'Your data is safely backed up automatically. Restore anytime with one click.',color:'bg-[#ff4f00]',gradient:'bg-gradient-to-br from-[#ff4f00]/10 to-white dark:from-[#ff4f00]/20 dark:to-transparent'},
    { icon: MessageCircle, title: t('landing.chat') || 'Live Chat Support', desc: t('landing.chatDesc') || 'Get instant answers through built-in live chat. Talk to your team directly from the app.', color: 'bg-pink-600', gradient: 'bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/10 dark:to-transparent' },
{icon: Timer,title: t('landing.eta')||'Egyptian Tax Authority & E-Invoice',desc: t('landing.etaDesc')||'Full compliance with the Egyptian Tax Authority(ETA)and the electronic invoicing system. Generate,send,and store e-invoices seamlessly.',color:'bg-[#364fab]',gradient:'bg-gradient-to-br from-[#364fab]/10 to-white dark:from-[#364fab]/20 dark:to-transparent'},
  ]

  const steps = [
    { icon: Store, title: t('landing.step1Title') || 'Create Your Store', desc: t('landing.step1Desc') || 'Sign up in seconds. No credit card required. Get started with a free plan instantly.' },
    { icon: Package, title: t('landing.step2Title') || 'Add Your Products', desc: t('landing.step2Desc') || 'Import your inventory or add products one by one. Set prices, stock levels, and categories.' },
    { icon: ShoppingCart, title: t('landing.step3Title') || 'Start Selling', desc: t('landing.step3Desc') || 'Process sales in seconds with our lightning-fast POS. Accept cash, cards, or digital wallets.' },
    { icon: BarChart3, title: t('landing.step4Title') || 'Track Everything', desc: t('landing.step4Desc') || 'Monitor sales, expenses, inventory, and employee performance in real-time dashboards.' },
  ]

  return (
<div dir={language==='ar'?'rtl':'ltr'}className={`min-h-screen bg-surface ${language==='ar'?'rtl':'ltr'}`}>
      {/* Navbar */}
<nav className="sticky top-0 z-50 bg-surface-secondary/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <img src="/dukkanza.svg" alt="Dukkanza" className="h-14 w-auto" />
<span className="text-xl font-extrabold text-foreground tracking-tight">{t('landing.brand')||'Dukkanza'}</span>
            </div>
            <div className="hidden md:flex items-center gap-7">
<a href="#features"className="text-sm font-medium text-muted hover:text-[#364fab] transition-colors">{t('landing.features')||'Features'}</a>
<a href="#how"className="text-sm font-medium text-muted hover:text-[#364fab] transition-colors">{t('landing.howItWorks')||'How It Works'}</a>
<Link to="/login"className="text-sm font-medium text-muted hover:text-[#364fab] transition-colors">{t('users.signIn')||'Login'}</Link>
              <button
                onClick={toggleLanguage}
className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted hover:text-[#364fab] border border-border rounded-lg hover:border-[#364fab]/40 transition-all"
              >
                <Globe className="w-4 h-4" />
                {language === 'en' ? 'عربي' : 'EN'}
              </button>
<Link to="/signup"className="px-5 py-2.5 bg-gradient-to-r from-[#364fab] to-[#2b3e94] text-white text-sm font-semibold rounded-xl hover:from-[#2b3e94] hover:to-[#233379] shadow-lg shadow-[#364fab]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#364fab]/30">
                {t('landing.startFree') || 'Start Free Trial'}
              </Link>
            </div>
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={toggleLanguage}
className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted border border-border rounded-lg"
              >
                <Globe className="w-3.5 h-3.5" />
                {language === 'en' ? 'عربي' : 'EN'}
              </button>
<Link to="/signup"className="px-4 py-2 bg-gradient-to-r from-[#364fab] to-[#2b3e94] text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#364fab]/25">
                {t('landing.startFree') || 'Start'}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
<div className="absolute inset-0 bg-gradient-to-br from-[#364fab]/10 via-white to-[#ff4f00]/10 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"/>
<div className="absolute top-0 left-1/4 w-96 h-96 bg-[#364fab] rounded-full blur-3xl animate-pulse"/>
<div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#ff4f00] rounded-full blur-3xl animate-pulse"style={{animationDelay:'1s'}}/>
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-[#364fab]/10 to-[#ff4f00]/10 rounded-full blur-3xl"/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-28 lg:py-44">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6 lp-hero-in">
              <img src="/dukkanza.svg" alt="Dukkanza" className="h-24 sm:h-36 lg:h-48 w-auto lp-float" />
            </div>
<h1 className="lp-hero-in lp-gradient-text bg-gradient-to-r from-[#2b3e94] via-[#364fab] to-[#ff4f00] bg-clip-text text-transparent text-3xl sm:text-5xl lg:text-8xl font-extrabold tracking-tight leading-[1.1] mb-8"style={{animationDelay:'120ms'}}>
              {t('landing.heroTitle') || 'Complete Store'}{' '}
              {t('landing.heroTitle2') || 'Management System'}
            </h1>
<p className="lp-hero-in text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed"style={{animationDelay:'240ms'}}>
              {t('landing.heroSubtitle') || 'Professional POS, inventory, HR, and accounting — all in one platform. Manage your store from anywhere.'}
            </p>
            <div className="lp-hero-in flex flex-col sm:flex-row items-center justify-center gap-4 mb-12" style={{ animationDelay: '360ms' }}>
              <Link
                to="/signup"
className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-10 py-4 bg-gradient-to-r from-[#364fab] to-[#2b3e94] text-white text-lg font-bold rounded-2xl hover:from-[#2b3e94] hover:to-[#233379] shadow-xl shadow-[#364fab]/25 transition-all duration-300 hover:shadow-2xl hover:shadow-[#364fab]/30 hover:-translate-y-0.5"
              >
                {t('landing.startFree') || 'Start Free Trial'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
<section id="features"className="py-24 sm:py-32 bg-surface-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="reveal text-center mb-16">
<h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-foreground mb-4">{t('landing.featuresTitle')||'Everything You Need to Run Your Store'}</h2>
<p className="text-base sm:text-lg text-muted max-w-2xl mx-auto">{t('landing.featuresSubtitle')||'One platform to manage sales,inventory,employees,finances,and customers.'}</p>
          </div>
          <div className="reveal lp-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="reveal text-center mb-16">
<h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-foreground mb-4">{t('landing.howTitle')||'Up and Running in Minutes'}</h2>
<p className="text-base sm:text-lg text-muted max-w-2xl mx-auto">{t('landing.howSubtitle')||'No complex setup. No training needed. Start managing your store today.'}</p>
          </div>
          <div className="reveal lp-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => <StepCard key={i} num={`0${i + 1}`} {...s} />)}
          </div>
        </div>
      </section>

      {/* Why Us */}
<section className="py-24 sm:py-32 bg-surface-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="reveal">
<h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-foreground mb-6 leading-tight">{t('landing.whyTitle')||'Built for Successful Store Owners'}</h2>
<p className="text-base sm:text-lg text-muted mb-8 leading-relaxed">{t('landing.whySubtitle')||"We understand the challenges of running a store. That's why we built a system that handles the complexity so you can focus on growth."}</p>
              <div className="reveal lp-stagger space-y-5">
                {[
{icon: Zap,text: t('landing.why1')||'Lightning-fast POS — process a sale in seconds',color:'bg-[#ff4f00]/10 text-[#ff4f00] dark:text-[#ff7a45]'},
{icon: Shield,text: t('landing.why2')||'Secure multi-users architecture with role-based access',color:'bg-[#364fab]/10 text-[#364fab] dark:text-[#8fa3e8]'},
                  { icon: Globe, text: t('landing.why3') || 'Bilingual support (English & Arabic)', color: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200' },
{icon: Star,text: t('landing.why4')||'Real-time analytics and customizable reports',color:'bg-[#ff4f00]/10 text-[#ff4f00] dark:text-[#ff7a45]'},
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <item.icon className="w-5 h-5" />
                    </div>
<span className="text-sm sm:text-base text-muted pt-2">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="reveal relative">
<div className="absolute -inset-4 bg-gradient-to-r from-[#364fab]/20 to-[#ff4f00]/20 rounded-3xl blur-2xl"/>
<div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-[#364fab]/20">
                <img
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=700&fit=crop&q=80"
                  alt="Store cashier using POS system"
                  className="w-full h-96 sm:h-[500px] lg:h-[600px] object-cover"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&h=700&fit=crop&q=80' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System tour — official YouTube tour (ID p46whL10hJ4) as a
          click-to-load lite embed: the animated mock and play button stand in
          until the user opts in, so no third-party iframe loads on page view */}
      <section id="demo" className="py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="reveal">
<h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-foreground mb-4">{t('landing.videoTitle')||'See Dukkanza in Action'}</h2>
<p className="text-base sm:text-lg text-muted max-w-2xl mx-auto">{t('landing.videoSubtitle')||'A quick tour of the POS,inventory,and reports your team uses every day.'}</p>
          </div>
          <div
className="reveal relative mt-10 mx-auto w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl shadow-[#364fab]/20 border border-border bg-gradient-to-br from-[#2b3e94] via-gray-900 to-gray-950"
            style={{ '--reveal-delay': '120ms' }}
          >
            {playing ? (
              <iframe
                className="absolute inset-0 h-full w-full bg-black"
                src="https://www.youtube-nocookie.com/embed/p46whL10hJ4?autoplay=1&rel=0"
                title={t('landing.videoTitle') || 'See Dukkanza in Action'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <>
                {/* Animated POS mock — pre-click facade for the tour video */}
                <div className="absolute inset-0 flex flex-col gap-3 p-4 sm:gap-5 sm:p-8" aria-hidden="true">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
<span className="h-2.5 w-2.5 rounded-full bg-warning"/>
<span className="h-2.5 w-2.5 rounded-full bg-success"/>
<span className="lp-sweep h-5 flex-1 rounded-md bg-white/10"/>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
className="lp-tile flex flex-col justify-end rounded-xl border border-white/10 bg-white/10 p-2 sm:p-4"
                        style={{ animationDelay: `${i * 0.3}s` }}
                      >
<div className="h-2 w-3/4 rounded bg-white/25 sm:h-3"/>
<div className="mt-2 h-2 w-1/2 rounded bg-[#364fab] sm:h-3"/>
                      </div>
                    ))}
                  </div>
<div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-3 py-2 sm:px-5 sm:py-3">
<div className="h-2.5 w-1/4 rounded bg-white/25 sm:h-3"/>
<div className="h-3 w-20 rounded bg-[#ff4f00] sm:h-4 sm:w-28"/>
                  </div>
                </div>

                {!playing && (
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    aria-label={t('landing.videoPlay') || 'Play the system tour video'}
                    className="group absolute inset-0 flex items-center justify-center"
                  >
<span className="lp-play-ring flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#ff4f00] shadow-xl transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative">
<div className="absolute -inset-4 bg-gradient-to-r from-[#364fab]/20 via-[#ff4f00]/20 to-[#364fab]/20 rounded-3xl blur-3xl"/>
<div className="reveal relative bg-gradient-to-r from-[#2b3e94] via-[#364fab] to-[#ff4f00] rounded-3xl p-8 sm:p-12 lg:p-20 text-white overflow-hidden shadow-2xl shadow-[#364fab]/20"style={{'--reveal-delay':'100ms'}}>
<div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"/>
<div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"/>
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"/>
              <div className="relative">
                <h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold mb-6 leading-tight">{t('landing.ctaTitle') || 'Ready to Manage Your Store?'}</h2>
<p className="text-base sm:text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">{t('landing.ctaSubtitle')||'Start your free trial today. No credit card required.'}</p>
                <Link
                  to="/signup"
className="inline-flex items-center gap-2.5 px-10 py-4 bg-surface text-[#ff4f00] text-lg font-bold rounded-2xl bg-surface-hover transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
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
<footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/dukkanza.svg" alt="Dukkanza" className="h-12 w-auto" />
<span className="font-extrabold text-foreground tracking-tight">{t('landing.brand')||'Dukkanza'}</span>
              </div>
<p className="text-sm text-muted leading-relaxed">{t('landing.footerDesc')||'Intelligent Solutions'}</p>
<Link to="/about"className="mt-3 inline-block text-sm text-muted hover:text-[#364fab] transition-colors">{t('landing.footerAbout')||'About Us'}</Link>
            </div>
            <div>
<h4 className="font-bold text-foreground mb-3">{t('landing.footerProduct')||'Product'}</h4>
<ul className="space-y-2.5 text-sm text-muted">
<li><a href="#features"className="hover:text-[#364fab] transition-colors">{t('landing.features')||'Features'}</a></li>
<li><a href="#how"className="hover:text-[#364fab] transition-colors">{t('landing.howItWorks')||'How It Works'}</a></li>
<li><Link to="/pricing"className="hover:text-[#364fab] transition-colors">{t('landing.footerPricing')||'Pricing'}</Link></li>
<li><Link to="/login"className="hover:text-[#364fab] transition-colors">{t('users.signIn')||'Login'}</Link></li>
              </ul>
            </div>
            <div>
<h4 className="font-bold text-foreground mb-3">{t('landing.footerSupport')||'Support'}</h4>
<ul className="space-y-2.5 text-sm text-muted">
<li><a href="https://wa.me/201555256213"target="_blank"rel="noopener noreferrer"className="hover:text-[#364fab] transition-colors">WhatsApp</a></li>
<li><a href="mailto:support@dukkanza.com"className="hover:text-[#364fab] transition-colors">Email</a></li>
<li><Link to="/contact"className="hover:text-[#364fab] transition-colors">{t('landing.footerContact')||'Contact Us'}</Link></li>
              </ul>
            </div>
            <div>
<h4 className="font-bold text-foreground mb-3">{t('landing.footerLegal')||'Legal'}</h4>
<ul className="space-y-2.5 text-sm text-muted">
<li><Link to="/privacy"className="hover:text-[#364fab] transition-colors">{t('landing.footerPrivacy')||'Privacy Policy'}</Link></li>
<li><Link to="/refund-policy"className="hover:text-[#364fab] transition-colors">{t('landing.footerRefund')||'Refund & Cancellation Policy'}</Link></li>
<li><button onClick={()=>setOpenModal('terms')}className="hover:text-[#364fab] transition-colors text-left">{t('landing.footerTerms')||'Terms of Service'}</button></li>
              </ul>
            </div>
          </div>
<div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted">
            © {new Date().getFullYear()} {t('landing.brand') || 'Dukkanza'}. {t('landing.footerRights') || 'All rights reserved.'}
          </div>
        </div>
      </footer>

      {/* Terms of Service Modal */}
      {openModal === 'terms' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpenModal(null)}>
<div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"onClick={(e)=>e.stopPropagation()}>
<div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
<h2 className="text-xl font-bold text-foreground">{language==='ar'?'شروط الخدمة':'Terms of Service'}</h2>
<button onClick={()=>setOpenModal(null)}className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted transition-colors">✕</button>
            </div>
<div className="px-6 py-6 space-y-6 text-sm text-muted leading-relaxed">
              {language === 'ar' ? (
                <>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">القبول بالشروط</h3>
                    <p>باستخدام منصة Dukkanza، أنت توافق على هذه الشروط. إذا لم توافق، يرجى عدم استخدام المنصة.</p>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">الحسابات والاشتراكات</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>يجب أن يكون عمرك 18 سنة أو أكثر لإنشاء حساب</li>
                      <li>أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول</li>
                      <li>الخطط المجانية لها حدود استخدام محددة</li>
                      <li>يمكنك إلغاء اشتراكك في أي وقت من لوحة التحكم</li>
                    </ul>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">المحتوى والبيانات</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>أنت تمتلك كل البيانات التي تدخلها في النظام</li>
                      <li>نحن لا نبيع أو نشارك بياناتك مع أطراف ثالثة</li>
                      <li>يجب عليك الامتثال للقوانين المحلية عند استخدام المنصة</li>
                    </ul>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">الإلغاء والاسترداد</h3>
                    <p>يمكنك إلغاء اشتراكك في أي وقت. لا يتم تقديم استرداد للمبالغ المدفوعة للفترة الحالية. سيبقى حسابك نشطاً حتى نهاية فترة الفوترة الحالية.</p>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">المسؤولية</h3>
                    <p>المنصة مقدمة "كما هي" دون ضمانات. نحن لسنا مسؤولين عن أي خسائر الناتجة عن استخدام المنصة.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">Acceptance of Terms</h3>
                    <p>By using Dukkanza, you agree to these terms. If you do not agree, please do not use the platform.</p>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">Accounts & Subscriptions</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>You must be 18 or older to create an account</li>
                      <li>You are responsible for maintaining the confidentiality of your login credentials</li>
                      <li>Free plans have specific usage limits</li>
                      <li>You can cancel your subscription at any time from the dashboard</li>
                    </ul>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">Content & Data</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>You own all data you enter into the system</li>
                      <li>We do not sell or share your data with third parties</li>
                      <li>You must comply with local laws when using the platform</li>
                    </ul>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">Cancellation & Refunds</h3>
                    <p>You may cancel your subscription at any time. No refunds are provided for the current billing period. Your account will remain active until the end of the current billing period.</p>
                  </div>
                  <div>
<h3 className="text-lg font-semibold text-foreground mb-2">Limitation of Liability</h3>
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
