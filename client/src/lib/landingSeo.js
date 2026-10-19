// Document-level SEO metadata for the landing page, per language. The Arabic
// variant is addressable at /?lang=ar (hreflang in index.html + sitemap.xml);
// LandingPage's SEO effect applies these values so each language ranks for its
// own queries. Kept in its own file because react-refresh requires component
// files to export only components (react-refresh/only-export-components).
export const LANDING_SEO = {
  en: {
    lang: 'en',
    title: 'Dukkanza | Store Management POS & Inventory System for Egypt',
    description: 'Dukkanza is a complete store management system with POS, inventory tracking, employee management, accounting, and Egyptian Tax Authority (ETA) e-invoice integration. Free trial available.',
    keywords: 'POS system, store management, inventory management, point of sale, Egypt, ERP, small business, stock management, employee management, accounting, e-invoice, ETA, dukkanza',
    canonical: 'https://dukkanza.com/',
    ogLocale: 'en_US',
    ldName: 'Dukkanza',
    ldDescription: 'Complete store management system with POS, inventory tracking, employee management, accounting, and Egyptian Tax Authority (ETA) e-invoice integration.',
  },
  ar: {
    lang: 'ar',
    title: 'دكانزا | نظام إدارة متاجر ونقطة بيع ومخزون ومحاسبة لمصر',
    description: 'دكانزا نظام إدارة متجر متكامل للمحلات: نقطة بيع، إدارة المخزون، الحسابات، إدارة الموظفين، والفوترة الإلكترونية لضريبة القيمة المضافة. جرّب مجاناً.',
    keywords: 'دكانزا, نظام إدارة المتاجر, نقطة بيع, إدارة المخزون, برنامج محاسبة, فوترة إلكترونية, ضريبة القيمة المضافة, برمجيات إدارة المحلات, مصر',
    canonical: 'https://dukkanza.com/?lang=ar',
    ogLocale: 'ar_EG',
    ldName: 'دكانزا (Dukkanza)',
    ldDescription: 'نظام إدارة متجر متكامل: نقطة بيع، إدارة المخزون، الحسابات، إدارة الموظفين، والفوترة الإلكترونية لضريبة القيمة المضافة.',
  },
}
