import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

/**
 * Chrome for the public (unauthenticated) pages — About, Contact, Privacy
 * and Refund Policy. Mirrors PricingPage: same surface, same back button
 * (arrow faces the reading direction, so it points right in Arabic), so
 * the whole public family feels like one site.
 */
export default function PublicPage({ title, subtitle, children, maxWidth = 'max-w-3xl' }) {
  const t = useAppStore((s) => s.t)
  const language = useAppStore((s) => s.language)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface-secondary py-8 sm:py-12 px-4">
      <div className={`${maxWidth} mx-auto`}>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-muted hover:text-foreground shadow-sm transition-colors"
          aria-label={t('common.back')}
        >
          {language === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          {t('common.back')}
        </button>

        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 sm:p-10">
          <header className="mb-8 pb-6 border-b border-border">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 text-base text-muted">{subtitle}</p>}
          </header>
          <div className="space-y-8 text-sm sm:text-base text-muted leading-relaxed">{children}</div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} {t('landing.brand') || 'Dukkanza'}
        </p>
      </div>
    </div>
  )
}

/** A titled section inside a PublicPage. Title may be bilingual content. */
export function PolicySection({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
