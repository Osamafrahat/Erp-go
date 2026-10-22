import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import PublicPage, { PolicySection } from '../components/PublicPage'

// Terms approved October 2026. Two product facts anchor this policy and
// must stay true in code for the policy to stay honest:
//  - there is NO auto-renewal anywhere (Paymob checkout and wallet
//    transfers are one-time payments; plans simply expire by date), and
//  - downgrades/cancellations are self-service from the Billing page.
export default function RefundPolicyPage() {
  const language = useAppStore((s) => s.language)
  const ar = language === 'ar'

  return (
    <PublicPage
      title={ar ? 'سياسة الاسترجاع والإلغاء' : 'Refund & Cancellation Policy'}
      subtitle={ar ? 'آخر تحديث: أكتوبر 2026' : 'Last updated: October 2026'}
    >
      <PolicySection title={ar ? 'ضمان الاسترجاع خلال 14 يومًا' : '14-Day Money-Back Guarantee'}>
        <p>
          {ar
            ? 'إن لم تكن راضيًا عن المنصة، يمكنك طلب استرجاع أول دفعة اشتراك خلال 14 يومًا من تاريخها. يشمل الضمان الدفعة الأولى للاشتراك فقط، ويُسترجع المبلغ بنفس طريقة الدفع الأصلية.'
            : 'If you are not satisfied with the platform, you may request a refund of your first subscription payment within 14 days of the payment date. The guarantee covers the initial subscription payment only, and the amount is returned through the original payment method.'}
        </p>
      </PolicySection>

      <PolicySection title={ar ? 'الإلغاء في أي وقت' : 'Cancellation Anytime'}>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            {ar
              ? 'لا يوجد تجديد تلقائي ولا خصم تلقائي: خططنا مدفوعة مسبقًا لفترة محددة وتنتهي بتاريخ انتهائها.'
              : 'There is no auto-renewal and no automatic charge: our plans are prepaid for a fixed period and simply expire on their end date.'}
          </li>
          <li>
            {ar
              ? 'يمكنك الإلغاء في أي وقت بترك الاشتراك ينتهي — تستمر في استخدام المنصة حتى نهاية الفترة المدفوعة، ولن تُخصم منك أي رسوم بعد ذلك.'
              : 'You can cancel at any time by letting the subscription lapse — you keep full access until the end of the paid period, and no further charges are made.'}
          </li>
          <li>
            {ar
              ? 'يمكنك أيضًا تخفيض خطتك أو إيقاف التجديد من صفحة الفوترة داخل المنصة.'
              : 'You can also downgrade or stop renewing at any time from the Billing page inside the platform.'}
          </li>
        </ul>
      </PolicySection>

      <PolicySection title={ar ? 'كيفية تنفيذ الاستردادات' : 'How Refunds Are Processed'}>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            {ar
              ? 'المدفوعات بالبطاقات (عبر Paymob): يُعاد المبلغ إلى البطاقة الأصلية خلال نحو 10 أيام عمل من موافقة الطلب.'
              : 'Card payments (via Paymob): the amount is returned to the original card within approximately 10 banking days of approval.'}
          </li>
          <li>
            {ar
              ? 'مدفوعات تحويل المحافظ (إنستاباي، فودافون كاش وغيرها): يُعاد المبلغ بعد التحقق من التحويل، عبر تحويل بنكي أو إلى محفظة، حسب ما يناسبك.'
              : 'Wallet-transfer payments (InstaPay, Vodafone Cash, etc.): after verifying the transfer, the amount is returned by bank transfer or to a wallet, whichever suits you.'}
          </li>
          <li>
            {ar
              ? 'تتم الموافقة على طلبات الاسترجاع خلال 3 أيام عمل كحد أقصى.'
              : 'Refund requests are approved within at most 3 business days.'}
          </li>
        </ul>
      </PolicySection>

      <PolicySection title={ar ? 'ما لا يشمله الاسترجاع' : 'What Is Not Refundable'}>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            {ar
              ? 'مدفوعات التجديد أو أي فترة تجاوزت 14 يومًا من تاريخ دفعها.'
              : 'Renewal payments, or any payment older than 14 days from its payment date.'}
          </li>
          <li>
            {ar
              ? 'فترات اشتراك استُخدمت جزئيًا أو كليًا.'
              : 'Subscription periods that have been used, in whole or in part.'}
          </li>
          <li>
            {ar
              ? 'الحسابات الموقوفة لمخالفة شروط الاستخدام.'
              : 'Accounts suspended for violating the terms of use.'}
          </li>
        </ul>
      </PolicySection>

      <PolicySection title={ar ? 'كيفية طلب استرجاع' : 'How to Request a Refund'}>
        <p>
          {ar
            ? 'أرسل بريدًا إلكترونيًا إلى'
            : 'Send an email to'}{' '}
          <a href="mailto:support@dukkanza.com" className="text-accent hover:underline">support@dukkanza.com</a>{' '}
          {ar
            ? 'من بريد حسابك، باسم الموضوع «طلب استرجاع»، مع اسم متجرك ومرجع الدفع (رقم طلب Paymob أو مرجع التحويل). سنرد على طلبك خلال 3 أيام عمل.'
            : 'from your account email with the subject “Refund request”, including your store name and payment reference (Paymob order id or transfer reference). We reply to requests within 3 business days.'}
        </p>
      </PolicySection>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link
          to="/contact"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent hover:bg-primary-700 text-white text-sm font-medium transition-colors"
        >
          {ar ? 'تواصل معنا' : 'Contact Us'}
        </Link>
        <Link
          to="/pricing"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
        >
          {ar ? 'الأسعار والخطط' : 'Plans & Pricing'}
        </Link>
      </div>
    </PublicPage>
  )
}
