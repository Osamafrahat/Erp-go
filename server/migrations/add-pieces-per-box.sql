-- Migration: Add pieces_per_box to products, sell_mode to order_items
-- Run this in Supabase SQL Editor

-- Add pieces_per_box column to products (box unit support)
ALTER TABLE products ADD COLUMN IF NOT EXISTS pieces_per_box INTEGER DEFAULT NULL;

-- Add sell_mode to order_items (tracks whether sold as box or pieces)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sell_mode TEXT DEFAULT NULL;
