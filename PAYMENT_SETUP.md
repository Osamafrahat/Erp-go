# Payment Setup Guide — Stripe + Paymob (EGP)

## Overview
- **Stripe**: International Visa/Mastercard + SaaS subscriptions
- **Paymob**: Local Egyptian cards + mobile wallets (Vodafone Cash, Orange Money, Etisalat Cash) + Fawry cash payments

---

## Part 1: Stripe Setup (US LLC Required)

### Step 1: Register a US LLC
1. Go to https://www.bizee.com/ or https://startglobal.co
2. Choose Wyoming or Delaware (cheapest, no state income tax)
3. Cost: ~$399 one-time (includes registered agent for 1 year)
4. Timeline: 3-7 business days for LLC formation

### Step 2: Get EIN (Employer Identification Number)
1. Apply at https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online
2. Or use your LLC formation service
3. Timeline: 2-4 weeks (can take longer)

### Step 3: Open a US Bank Account
Options:
- **Mercury** (https://mercury.com) — Most popular for non-residents, 1-2 weeks
- **Relay** (https://relayfi.com)
- **Payoneer** (https://payoneer.com) — Also works
- **Wise Business** (https://wise.com) — Good for USD/EGP conversion

Requirements: LLC documents + EIN + US phone number (use Dingtone or Skype)

### Step 4: Get a US Phone Number
- Dingtone app (free/cheap)
- Skype Number
- Google Voice (if available)
- Used for: Stripe verification + bank account

### Step 5: Create Stripe Account
1. Go to https://dashboard.stripe.com/register
2. Business location: United States
3. Business type: Company → Single-member LLC
4. Add your LLC name, EIN, registered agent address
5. Add US bank account for payouts
6. Enable 2FA
7. Timeline: 1-2 business days for verification

### Step 6: Create Price Objects in Stripe
1. Go to https://dashboard.stripe.com/products
2. Create a product: "Pro Plan"
   - Add price: 599 EGP/month
   - Add price: 5990 EGP/year
3. Create a product: "Enterprise Plan"
   - Add price: 1499 EGP/month
   - Add price: 14990 EGP/year
4. Copy the Price IDs (format: `price_xxx`)

### Step 7: Set Up Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://erp-go-crimson-wind-2087.fly.dev/api/billing/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
4. Copy the webhook signing secret (format: `whsec_xxx`)

### Step 8: Configure Environment Variables on Fly.io
Run these commands:
```bash
fly secrets set STRIPE_SECRET_KEY=sk_live_xxx --app erp-go-crimson-wind-2087
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx --app erp-go-crimson-wind-2087
fly secrets set STRIPE_PRO_PRICE_ID=price_xxx --app erp-go-crimson-wind-2087
fly secrets set STRIPE_ENTERPRISE_PRICE_ID=price_xxx --app erp-go-crimson-wind-2087
```

### Step 9: Enable EGP Currency in Stripe
1. Go to https://dashboard.stripe.com/settings/currencies
2. Enable EGP (Egyptian Pound) as a payout currency
3. Note: Stripe settles in USD by default, EGP conversion happens at your bank

---

## Part 2: Paymob Setup (Egyptian Local Payments)

### Step 1: Create Paymob Account
1. Go to https://www.paymob.com/en/egypt/registration
2. Register as a merchant
3. Complete KYC (Egyptian ID, commercial register, bank account)
4. Timeline: 1-3 business days

### Step 2: Get API Credentials
1. Login to https://dashboard.paymob.com
2. Go to Settings → API Keys
3. Copy:
   - **API Key** (for authentication)
   - **Integration ID** (for the payment method)
   - **HMAC Secret** (for webhook verification)

### Step 3: Create Payment Integrations
In Paymob Dashboard:
1. Go to Payment Methods → Card
   - Copy the Integration ID
2. Go to Payment Methods → Mobile Wallets
   - Enable Vodafone Cash, Orange Money, Etisalat Cash
   - Copy the Integration ID
3. Go to Payment Methods → Fawry
   - Enable Fawry
   - Copy the Integration ID

### Step 4: Configure Webhook
1. Go to Settings → Webhooks
2. Add callback URL: `https://erp-go-crimson-wind-2087.fly.dev/api/billing/paymob/webhook`
3. Copy the HMAC Secret

### Step 5: Configure Environment Variables on Fly.io
```bash
fly secrets set PAYMOB_API_KEY=xxx --app erp-go-crimson-wind-2087
fly secrets set PAYMOB_CARD_INTEGRATION_ID=xxx --app erp-go-crimson-wind-2087
fly secrets set PAYMOB_WALLET_INTEGRATION_ID=xxx --app erp-go-crimson-wind-2087
fly secrets set PAYMOB_FAWRY_INTEGRATION_ID=xxx --app erp-go-crimson-wind-2087
fly secrets set PAYMOB_HMAC_SECRET=xxx --app erp-go-crimson-wind-2087
fly secrets set PAYMOB_IFRAME_ID=xxx --app erp-go-crimson-wind-2087
```

---

## Part 3: Pricing (EGP)

| Plan | Monthly | Yearly | Products | Users | Orders/mo |
|------|---------|--------|----------|-------|-----------|
| Free | 0 EGP | 0 EGP | 50 | 2 | 100 |
| Pro | 599 EGP | 5,990 EGP | 500 | 15 | Unlimited |
| Enterprise | 1,499 EGP | 14,990 EGP | Unlimited | Unlimited | Unlimited |

---

## Part 4: Testing

### Stripe Test Mode
1. Use test API keys (sk_test_xxx, pk_test_xxx)
2. Test card: 4242 4242 4242 4242
3. Test in Stripe Dashboard → Payments → View test mode

### Paymob Test Mode
1. Use test API keys from Paymob Dashboard
2. Test card numbers in Paymob docs
3. Test Fawry in sandbox mode

---

## Part 5: Go Live Checklist

- [ ] US LLC registered and EIN obtained
- [ ] US bank account opened
- [ ] Stripe account verified
- [ ] Price objects created in Stripe
- [ ] Stripe webhook configured
- [ ] Paymob account registered and verified
- [ ] Paymob integrations configured
- [ ] Paymob webhook configured
- [ ] All environment variables set on Fly.io
- [ ] Test payment flow end-to-end
- [ ] Switch to live API keys

---

## Cost Summary

| Service | Cost |
|---------|------|
| US LLC (Bizee) | ~$399 one-time |
| EIN | Free (IRS) |
| US Bank Account | Free (Mercury) |
| US Phone Number | ~$5/month (Dingtone) |
| Stripe Fees | 2.9% + 30¢ per transaction |
| Paymob Fees | ~2.5% + 1 EGP per transaction |

---

## Resources

- Stripe Egypt Guide: https://startglobal.co/us/international/egypt/stripe/
- Paymob Documentation: https://developers.paymob.com
- Paymob Egypt Registration: https://www.paymob.com/en/egypt/registration
- Dingtone (US Phone): https://www.dingtone.me
