CREATE TABLE IF NOT EXISTS ventrasim_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  env ventra_env NOT NULL,
  order_id text NOT NULL,
  amount integer,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'AWAITING_PAYMENT',
  charge_id text,
  txid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (env, order_id)
);

CREATE INDEX IF NOT EXISTS ventrasim_orders_env_order_id_idx ON ventrasim_orders(env, order_id);
