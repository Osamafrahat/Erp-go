-- Update subscription plans to Egypt EGP pricing
UPDATE subscription_plans SET
  price_monthly = 0, price_yearly = 0,
  max_products = 50, max_users = 2, max_orders_monthly = 100,
  features = '["basic_pos","inventory","reports"]'
WHERE slug = 'free';

UPDATE subscription_plans SET
  price_monthly = 599, price_yearly = 5990,
  max_products = 500, max_users = 15, max_orders_monthly = -1,
  features = '["basic_pos","inventory","reports","accounting","hr","services","priority_support"]'
WHERE slug = 'pro';

UPDATE subscription_plans SET
  price_monthly = 1499, price_yearly = 14990,
  max_products = -1, max_users = -1, max_orders_monthly = -1,
  features = '["basic_pos","inventory","reports","accounting","hr","services","priority_support","custom_integrations","dedicated_support"]'
WHERE slug = 'enterprise';

SELECT slug, price_monthly, price_yearly, max_products, max_users FROM subscription_plans ORDER BY price_monthly;
