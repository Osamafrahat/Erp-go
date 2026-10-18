# Payment Setup Guide — Paymob (EGP)

> **Note:** Stripe was removed from this project (no Stripe code, secrets, or
> webhooks remain). Paymob plus the Egyptian wallet-transfer flow below is the
> complete payment path.

## Overview
- **Paymob**: Egyptian cards + mobile wallets (Vodafone Cash, Orange Money, Etisalat Cash) + Fawry cash payments
- **Wallet transfer**: Egyptian wallet-transfer flow configured server-side via `WALLET_CONFIG`, with SUPER_ADMIN review on submission

---

## Part 1: Paymob Setup (Egyptian Local Payments)

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

## Part 2: Pricing (EGP)

| Plan | Monthly | Yearly | Products | Users | Orders/mo |
|------|---------|--------|----------|-------|-----------|
| Free | 0 EGP | 0 EGP | 50 | 2 | 100 |
| Pro | 599 EGP | 5,990 EGP | 500 | 15 | Unlimited |
| Enterprise | 1,499 EGP | 14,990 EGP | Unlimited | Unlimited | Unlimited |

---

## Part 3: Testing

### Paymob Test Mode
1. Use test API keys from Paymob Dashboard
2. Test card numbers in Paymob docs
3. Test Fawry in sandbox mode

---

## Part 4: Go Live Checklist

- [ ] Paymob account registered and verified
- [ ] Paymob integrations configured
- [ ] Paymob webhook configured
- [ ] Wallet transfer (`WALLET_CONFIG`) numbers verified
- [ ] All environment variables set on Fly.io
- [ ] Test payment flow end-to-end
- [ ] Switch to live API keys

---

## Cost Summary

| Service | Cost |
|---------|------|
| Paymob Fees | ~2.5% + 1 EGP per transaction |

---

## Resources

- Paymob Documentation: https://developers.paymob.com
- Paymob Egypt Registration: https://www.paymob.com/en/egypt/registration
