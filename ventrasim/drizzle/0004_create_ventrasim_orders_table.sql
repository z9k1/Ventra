CREATE TABLE IF NOT EXISTS ventrasim_orders (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL,
  order_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL,
  charge_id TEXT,
  txid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (env, order_id)
);
