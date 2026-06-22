-- Railway PostgreSQL — birinchi ishga tushganda avtomatik bajariladi

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brands JSONB NOT NULL DEFAULT '[]'::jsonb,
  categories JSONB NOT NULL DEFAULT '["Parfyum","Shampun","Dezodorant","Kosmetika"]'::jsonb
);

INSERT INTO catalog (id, brands, categories)
VALUES (1, '[]'::jsonb, '["Parfyum","Shampun","Dezodorant","Kosmetika"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  note TEXT,
  payment_type TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
