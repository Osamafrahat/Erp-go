import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import PublicPage, { PolicySection } from '../components/PublicPage'

// Contact details live in one map so EN/AR can never drift apart.
// Phone is the same number the landing footer has always published
// (WhatsApp wa.me/201555256213 → +20 1555 256 213).
const CONTACT = {
  email: 'support@dukkanza.com',
  phoneDisplay: '+20 1555 256 213',
  phoneTel: '+201555256213',
  whatsapp: 'https://wa.me/201555256213',
  city: { en: 'Alexandria, Egypt', ar: 'الإسكندرية، مصر' },
}

export default function ContactPage() {
  const language = useAppStore((s) => s.language)
  const ar = language === 'ar'

  return (
    <PublicPage
      title={ar ? 'تواصل معنا' : 'Contact Us'}
      subtitle={ar ? 'نحن هنا للمساعدة — تواصل معنا عبر أي من القنوات التالية' : 'We are here to help — reach us through any of the channels below'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a
          href={`mailto:${CONTACT.email}`}
          className="flex flex-col items-start gap-2 p-5 rounded-xl border border-border bg-surface-secondary hover:border-accent transition-colors"
        >
          <Mail className="w-5 h-5 text-accent" />
          <span className="font-semibold text-foreground">{ar ? 'البريد الإلكتروني' : 'Email'}</span>
          <span className="text-sm break-all">{CONTACT.email}</span>
        </a>

        <div className="flex flex-col items-start gap-2 p-5 rounded-xl border border-border bg-surface-secondary">
          <Phone className="w-5 h-5 text-accent" />
          <span className="font-semibold text-foreground">{ar ? 'الهاتف وواتساب' : 'Phone & WhatsApp'}</span>
          <a href={`tel:${CONTACT.phoneTel}`} className="text-sm hover:text-accent transition-colors" dir="ltr">
            {CONTACT.phoneDisplay}
          </a>
          <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
            WhatsApp
          </a>
        </div>

        <div className="flex flex-col items-start gap-2 p-5 rounded-xl border border-border bg-surface-secondary">
          <MapPin className="w-5 h-5 text-accent" />
          <span className="font-semibold text-foreground">{ar ? 'الموقع' : 'Location'}</span>
          <span className="text-sm">{CONTACT.city[language === 'ar' ? 'ar' : 'en']}</span>
        </div>
      </div>

      <PolicySection title={ar ? 'ساعات الدعم' : 'Support Hours'}>
        <p className="inline-flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent shrink-0" />
          {ar ? 'من الأحد إلى الخميس' : 'Sunday – Thursday'}
        </p>
        <p>
          {ar
            ? 'نرد عادةً خلال يوم عمل واحد على رسائل البريد الإلكتروني.'
            : 'We typically reply to emails within one business day.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'ماذا تكتب لنا' : 'What to Write To Us About'}>
        <ul className="list-disc ps-5 space-y-1">
          <li>{ar ? 'أسئلة الفوترة والاشتراكات وطلبات الاسترجاع' : 'Billing, subscription and refund questions'}</li>
          <li>{ar ? 'مشاكل تقنية أو طلبات مساعدة في استخدام المنصة' : 'Technical issues or help using the platform'}</li>
          <li>{ar ? 'طلبات حذف أو تصدير بيانات حسابك' : 'Requests to export or delete your account data'}</li>
        </ul>
        <p className="text-sm text-muted">
          {ar
            ? 'عند مراسلتنا عن الفوترة أو الدفع، أرفق اسم متجرك ومرجع الدفع (رقم طلب Paymob أو مرجع التحويل).'
            : 'For billing or payment matters, include your store name and payment reference (Paymob order id or transfer reference).'}
        </p>
        <p>
          <Link to="/pricing" className="text-accent hover:underline font-medium">
            {ar ? 'عرض الأسعار والخطط' : 'View plans & pricing'}
          </Link>
        </p>
      </PolicySection>

      <p className="text-sm text-muted border-t border-border pt-6">
        {ar
          ? 'نخدم المتاجر في جميع أنحاء مصر عن بُعد — التأهيل والدعم يتم عن بُعد بالكامل.'
          : 'We serve stores across Egypt remotely — onboarding and support happen fully online.'}
      </p>
    </PublicPage>
  )
}
