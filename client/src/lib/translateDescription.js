// Translate journal entry descriptions based on prefix matching
// Works for both English and Arabic language modes
export function translateDescription(t, desc) {
  if (!desc) return ''

  const prefixes = [
    { en: 'AR - ', key: 'accounting.desc.arFor' },
    { en: 'Payment for ', key: 'accounting.desc.paymentFor' },
    { en: 'Sale - ', key: 'accounting.desc.sale' },
    { en: 'VAT for ', key: 'accounting.desc.vatFor' },
    { en: 'COGS for ', key: 'accounting.desc.cogsFor' },
    { en: 'Inventory out - ', key: 'accounting.desc.inventoryOut' },
    { en: 'Refund - Order refund', key: 'accounting.desc.refundOrder' },
    { en: 'Refund payment', key: 'accounting.desc.refundPayment' },
    { en: 'Inventory restored - refund', key: 'accounting.desc.inventoryRestored' },
    { en: 'COGS reversed - refund', key: 'accounting.desc.cogsReversed' },
    { en: 'Refund for order', key: 'accounting.desc.refundForOrder' },
    { en: 'Expense: ', key: 'accounting.desc.expense' },
    { en: 'Payment for expense', key: 'accounting.desc.paymentForExpense' },
    { en: 'Stock in: ', key: 'accounting.desc.stockIn' },
    { en: 'AP - ', key: 'accounting.desc.apFor' },
    { en: 'Stock receive - ', key: 'accounting.desc.stockReceive' },
    { en: 'Stock adj up: ', key: 'accounting.desc.stockAdjUp' },
    { en: 'Stock adj down: ', key: 'accounting.desc.stockAdjDown' },
    { en: 'Stock adjust - ', key: 'accounting.desc.stockAdjust' },
    { en: 'Reversal of: ', key: 'accounting.desc.reversal' },
    { en: 'Reversal of ', key: 'accounting.desc.reversalOf' },
    { en: 'Reversal: ', key: 'accounting.desc.reversal' },
    { en: 'Payment received - ', key: 'accounting.desc.paymentReceived' },
    { en: 'AR reduction - ', key: 'accounting.desc.arReduction' },
    { en: 'AP reduction - ', key: 'accounting.desc.apReduction' },
    { en: 'Payment made - ', key: 'accounting.desc.paymentMade' },
    { en: 'Payment inbound: ', key: 'accounting.desc.paymentReceived' },
    { en: 'Payment outbound: ', key: 'accounting.desc.paymentMade' },
    { en: 'Year-end closing for ', key: 'accounting.desc.yearEndClosing' },
    { en: 'Initial capital contribution - ', key: 'accounting.desc.initialCapital' },
  ]

  for (const p of prefixes) {
    if (desc.startsWith(p.en)) {
      const rest = desc.slice(p.en.length)
      const translated = t(p.key)
      if (translated !== p.key) {
        return rest ? `${translated} ${rest}` : translated
      }
    }
  }

  // Also check if description starts with an already-translated prefix (Arabic)
  const arPrefixes = [
    'دفعة للطلب', 'بيع -', 'ضريبة للطلب', 'تكلفة البضاعة للطلب',
    'إخراج مخزون -', 'مصروف:', 'دفعة للمصروف', 'استلام:', 'دائن -',
    'استلام مخزون -', 'تعديل مخزون صاعد:', 'تعديل مخزون هابط:',
    'تعديل مخزون -', 'عكس:', 'عكس ', 'دفعة مستلمة -', 'تخفيض مدينة -',
    'تخفيض دائنة -', 'دفعة صادرة -', 'إقفال نهاية السنة لـ',
  ]
  for (const ar of arPrefixes) {
    if (desc.startsWith(ar)) return desc
  }

  return desc
}
