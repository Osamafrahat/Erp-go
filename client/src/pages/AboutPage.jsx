import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import PublicPage, { PolicySection } from '../components/PublicPage'

export default function AboutPage() {
  const language = useAppStore((s) => s.language)
  const ar = language === 'ar'

  return (
    <PublicPage
      title={ar ? 'من نحن' : 'About Us'}
      subtitle={ar ? 'دكانزا — منصة إدارة متكاملة للمحلات المصرية' : 'Dukkanza — an all-in-one management platform for Egyptian stores'}
    >
      <PolicySection title={ar ? 'من نحن' : 'Who We Are'}>
        <p>
          {ar
            ? 'دكانزا منصة سحابية أُنشئت في الإسكندرية لتمكين المحلات الصغيرة والمتوسطة في مصر من إدارة أعمالها كاملةً من مكان واحد: نقطة البيع، المخزون، الموظفين، المحاسبة، والتقارير — بواجهة عربية وإنجليزية وسعريين بالجنيه المصري.'
            : 'Dukkanza is a cloud platform founded in Alexandria to give small and medium Egyptian stores one place to run their entire business — point of sale, inventory, employees, accounting and reporting — with a full Arabic and English interface and prices in Egyptian Pounds.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'ماذا نقدم' : 'What We Offer'}>
        <ul className="list-disc ps-5 space-y-1">
          <li>{ar ? 'نقطة بيع وفواتير وورديات نقدية ومرتجعات' : 'Point of sale, invoicing, cash shifts and refunds'}</li>
          <li>{ar ? 'إدارة المخزون والمشتريات وطلبات الشراء والمخزون الميت' : 'Inventory, suppliers, purchase orders and dead-stock tracking'}</li>
          <li>{ar ? 'العملاء والبيع بالآجل والعمولات والعروض الترويجية' : 'Customers, credit sales, commissions and promotions'}</li>
          <li>{ar ? 'الموظفين: الحضور والإجازات والورديات والرواتب وتقييم الأداء' : 'HR: attendance, leave, shifts, payroll and performance reviews'}</li>
          <li>{ar ? 'محاسبة كاملة: دليل الحسابات والقيود والمدفوعات والتقارير' : 'Full accounting: chart of accounts, journal entries, payments and reports'}</li>
          <li>{ar ? 'الفروع المتعددة والمحادثة الداخلية والنسخ الاحتياطي' : 'Multi-branch support, team chat and automatic backups'}</li>
        </ul>
      </PolicySection>

      <PolicySection title={ar ? 'لماذا دكانزا' : 'Why Stores Choose Us'}>
        <ul className="list-disc ps-5 space-y-1">
          <li>{ar ? 'واجهة عربية كاملة وإنجليزية — بالتبديل بضغطة واحدة' : 'Full Arabic and English interface — switch with one click'}</li>
          <li>{ar ? 'طرق دفع مصرية: Paymob (بطاقات)، إنستاباي، فودافون كاش وغيرها' : 'Egyptian payment methods: Paymob cards, InstaPay, Vodafone Cash and more'}</li>
          <li>{ar ? 'أسعار واضحة بالجنيه المصري، بدون رسوم مخفية وبدون تجديد تلقائي' : 'Clear EGP pricing — no hidden fees and no auto-renewal charges'}</li>
          <li>{ar ? 'عزل كامل للبيانات بين المتاجر وتشفير أثناء النقل' : 'Full data isolation between stores, with encryption in transit'}</li>
          <li>{ar ? 'يعمل على أي جهاز، مع وضع عدم اتصال لنقطة البيع' : 'Works on any device, with an offline mode for the POS'}</li>
        </ul>
      </PolicySection>

      <PolicySection title={ar ? 'قيمنا' : 'Our Values'}>
        <p>
          {ar
            ? 'نؤمن بالبساطة والشفافية: تعرف بالضبط ما تدفعه ومقابل ماذا، وبياناتك ملكك — تصديرها أو حذفها متى شئت.'
            : 'Simplicity and transparency: you always know exactly what you pay and what you get, and your data stays yours — export or delete it whenever you want.'}
        </p>
      </PolicySection>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link
          to="/pricing"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent hover:bg-primary-700 text-white text-sm font-medium transition-colors"
        >
          {ar ? 'شاهد الأسعار' : 'View Pricing'}
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
        >
          {ar ? 'تواصل معنا' : 'Contact Us'}
        </Link>
      </div>
    </PublicPage>
  )
}
