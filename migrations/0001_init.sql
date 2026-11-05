CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category3 TEXT NOT NULL DEFAULT '',
  category4 TEXT NOT NULL DEFAULT '',
  leaf_category TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 999,
  makeover INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(leaf_category, product_name)
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category3, category4, leaf_category);
CREATE INDEX IF NOT EXISTS idx_products_priority ON products(priority);
