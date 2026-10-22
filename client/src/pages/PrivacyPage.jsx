import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import PublicPage, { PolicySection } from '../components/PublicPage'

// The full policy lives here as a public page (the landing footer's old
// privacy modal was migrated into this page in October 2026).
export default function PrivacyPage() {
  const language = useAppStore((s) => s.language)
  const ar = language === 'ar'

  return (
    <PublicPage
      title={ar ? 'سياسة الخصوصية' : 'Privacy Policy'}
      subtitle={ar ? 'آخر تحديث: أكتوبر 2026' : 'Last updated: October 2026'}
    >
      <PolicySection title={ar ? 'المعلومات التي نجمعها' : 'Information We Collect'}>
        <p>{ar ? 'نقوم بجمع المعلومات التالية عند إنشاء حسابك واستخدام المنصة:' : 'We collect the following information when you create your account and use the platform:'}</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>{ar ? 'الاسم واسم المتجر وعنوان البريد الإلكتروني' : 'Your name, store name, and email address'}</li>
          <li>{ar ? 'بيانات المعاملات المالية (المبيعات، المصروفات، الفواتير)' : 'Financial transaction data (sales, expenses, invoices)'}</li>
          <li>{ar ? 'معلومات الموظفين والعملاء التي تدخلها في النظام' : 'Employee and customer information you enter into the system'}</li>
          <li>{ar ? 'عنوان IP ومعلومات الجهاز لأغراض الأمان' : 'IP address and device information for security purposes'}</li>
        </ul>
      </PolicySection>

      <PolicySection title={ar ? 'ملفات تعريف الارتباط والتخزين المحلي' : 'Cookies & Local Storage'}>
        <p>
          {ar
            ? 'نستخدم ملفات تعريف الارتباط وتخزين المتصفح للبقاء مسجّل الدخول وتشغيل ميزات العمل دون اتصال على الأجهزة التي تصرّح بها. يمكنك مسحها في أي وقت من إعدادات المتصفح، لكن بعض ميزات المنصة قد تتوقف عن العمل بعدها.'
            : 'We use cookies and browser storage to keep you signed in and to power offline features on devices you authorise. You can clear them at any time through your browser settings, though some platform features may stop working afterwards.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'كيف نستخدم معلوماتك' : 'How We Use Your Information'}>
        <ul className="list-disc ps-5 space-y-1">
          <li>{ar ? 'تشغيل وتحسين خدمات المنصة' : 'To operate and improve platform services'}</li>
          <li>{ar ? 'إرسال إشعارات متعلقة بحسابك واشتراكك' : 'To send notifications related to your account and subscription'}</li>
          <li>{ar ? 'حماية حسابك ومنع الوصول غير المصرح به' : 'To protect your account and prevent unauthorized access'}</li>
          <li>{ar ? 'الامتثال للمتطلبات القانونية' : 'To comply with legal requirements'}</li>
        </ul>
      </PolicySection>

      <PolicySection title={ar ? 'مشاركة البيانات' : 'Data Sharing'}>
        <p>
          {ar
            ? 'لا نبيع بياناتك لأي طرف. لا نشاركها إلا مع بوابة الدفع (Paymob) لمعالجة مدفوعات التي تجريها أنت، ومزودي البنية التحتية اللازمين لتشغيل الخدمة (الاستضافة وخدمة البريد) باتفاقيات سرية.'
            : 'We do not sell your data. We share it only with the payment processor (Paymob) for payments you initiate, and with the infrastructure providers strictly needed to run the service (hosting and email delivery) under confidentiality agreements.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'أمن البيانات' : 'Data Security'}>
        <p>
          {ar
            ? 'نستخدم تشفير SSL/TLS لحماية بياناتك. بياناتك محفوظة بشكل آمن في بنية Supabase السحابية مع عزل كامل لكل مستأجر.'
            : 'We use SSL/TLS encryption to protect your data. Your data is securely stored in Supabase cloud infrastructure with full tenant isolation.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'الاحتفاظ بالبيانات وحذفها' : 'Data Retention & Deletion'}>
        <p>
          {ar
            ? 'تُحفظ بيانات طالما حسابك نشط. يمكنك طلب تصدير بياناتك أو حذف حسابك بالكامل في أي وقت عبر الدعم، ويتم تنفيذ الحذف خلال المدة المعقولة التي يقتضيها القانون.'
            : 'Your data is kept for as long as your account is active. You can request an export of your data or full deletion of your account at any time through support; deletion is carried out within a reasonable period as required by law.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'حقوقك' : 'Your Rights'}>
        <p>
          {ar
            ? 'يحق لك الوصول إلى بياناتك وتصديرها وحذفها في أي وقت. يمكنك طلب حذف حسابك بالكامل من خلال الدعم الفني.'
            : 'You have the right to access, export, and delete your data at any time. You can request full account deletion through our support team.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'تعديلات على هذه السياسة' : 'Changes to This Policy'}>
        <p>
          {ar
            ? 'قد نحدّث هذه السياسة من وقت لآخر. النسخة الأحدث متاحة دائمًا على هذه الصفحة مع تاريخ آخر تحديث.'
            : 'We may update this policy from time to time. The latest version is always available on this page, with its revision date at the top.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'التواصل' : 'Contact'}>
        <p>
          {ar
            ? 'لأي استفسارات حول سياسة الخصوصية، تواصل معنا عبر البريد الإلكتروني:'
            : 'For any questions about this Privacy Policy, contact us at:'}{' '}
          <a href="mailto:support@dukkanza.com" className="text-accent hover:underline">support@dukkanza.com</a>
        </p>
        <p>
          <Link to="/refund-policy" className="text-accent hover:underline font-medium">
            {ar ? 'سياسة الاسترجاع والإلغاء' : 'Refund & Cancellation Policy'}
          </Link>
        </p>
      </PolicySection>
    </PublicPage>
  )
}
