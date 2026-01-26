# Ventra Monorepo

Este repositorio contem tres apps:

- Escrow Pix API (backend): FastAPI + Postgres com ledger append-only.
- Ventra Frontend: Next.js (UI estilo Ventra) para operar pedidos/escrow.
- VentraSim: Next.js (Merchant Simulator) para receber e auditar webhooks do Ventra.

## Visao geral

Fluxo principal (sandbox):

1) Criar Order com valor.
2) Gerar Charge Pix com expiracao (default 15 min).
3) Simular pagamento (sandbox) para confirmar pagamento.
4) Fundos ficam em custodia (escrow) e podem ser liberados ao merchant ou reembolsados ao customer.

Regras principais:

- Ledger append-only: saldo e derivado do ledger, nunca atualizado diretamente.
- Maquina de estados rigida para Order e Charge.
- Idempotencia via header `Idempotency-Key` em POST criticos.
- Webhooks assinados com HMAC SHA-256.

## Requisitos

- Python 3.11+
- Docker Desktop (Postgres)
- Node + pnpm (frontend Ventra)
- Node + npm (VentraSim)

## 1) Banco (Postgres)

Na raiz do repo:

```bash
docker compose up -d
```

Container default: `apidepagamento-db-1` em `localhost:5432`.

## 2) Backend (Escrow Pix API)

### Config

Crie `.env` na raiz (copie de `.env.example`):

- `DATABASE_URL=postgresql+psycopg2://escrow:escrow@localhost:5432/escrow`
- `API_KEY=<your-secret>`
- `ENV=sandbox`

No PowerShell, pode exportar so para a sessao:

```powershell
$env:DATABASE_URL="postgresql+psycopg2://escrow:escrow@localhost:5432/escrow"
$env:API_KEY="<your-secret>"
$env:ENV="sandbox"
```

### Migrations

```powershell
python -m alembic upgrade head
```

### Rodar API

```powershell
uvicorn app.main:app --reload
```

Docs: `http://localhost:8000/docs`

### Endpoints principais

Auth: `X-API-KEY: <API_KEY>`

- POST `/orders` { amount_cents, currency }
- GET `/orders/{order_id}`
- POST `/orders/{order_id}/charges/pix`
- POST `/charges/{charge_id}/simulate-paid` (sandbox only)
- POST `/charges/{charge_id}/cancel`
- POST `/orders/{order_id}/release`
- POST `/orders/{order_id}/refund`
- GET `/orders/{order_id}/ledger`
- GET `/balance`

Idempotencia: envie `Idempotency-Key` em POST criticos.

## 3) Frontend Ventra (UI)

### Rodar

```powershell
cd frontend
pnpm install
pnpm dev
```

### Configuracao

Abra `http://localhost:3000/settings` e configure:

- `API_BASE_URL`: `http://localhost:8000`
- `API_KEY`: `<your-secret>`

A UI usa `/api/proxy` para evitar CORS.

### Demo flow

1) `+ Novo Deposito`
2) Confirma valor -> cria Order e Charge Pix
3) Simular pagamento
4) Release ou Refund
5) Ver saldo e ledger

## 4) Ventra → VentraSim Webhooks

O backend do Ventra dispara automaticamente os eventos (`order.paid_in_escrow`, `payment.paid`, `order.released`, `order.refunded`, etc.) sempre que o estado do order muda. Para ativar basta configurar duas variáveis de ambiente no `.env`:

```dotenv
WEBHOOK_URL=http://localhost:3001/api/webhooks/ventra/sandbox
WEBHOOK_SECRET=dev-webhook-secret
```

Se o Ventra estiver rodando dentro de Docker, substitua `localhost` por `host.docker.internal` para que o container consiga alcançar o VentraSim (`http://host.docker.internal:3001/api/webhooks/ventra/sandbox`).

Com essa configuração o FastAPI registra logs como `sending webhook payment.paid to ...`, permitindo confirmar no console que o callback foi disparado. A assinatura HMAC é calculada com o valor de `WEBHOOK_SECRET`, então mantenha o mesmo valor na tabela `webhook_endpoints` da VentraSim (`env = sandbox`).

Você pode inspecionar a subscription ativa diretamente no Postgres:

```powershell
docker exec -i apidepagamento-db-1 psql -U escrow -d escrow -c "select url, secret, is_enabled from webhook_subscriptions;"
```

O registro é criado automaticamente no startup do `uvicorn app.main:app` sempre que `WEBHOOK_URL`/`WEBHOOK_SECRET` estiverem definidos.

## 5) VentraSim (Webhook Receiver)

### Config

VentraSim usa o mesmo Postgres do docker-compose. Defina `DATABASE_URL`:

```powershell
$env:DATABASE_URL="postgresql://escrow:escrow@localhost:5432/escrow"
```

### Rodar

```powershell
cd ventrasim
npm install
npm run dev
```

### Schema (VentraSim)

As tabelas sao:

- `webhook_endpoints`
- `webhook_events`
- `webhook_deliveries`

Se precisar aplicar o SQL gerado (nao via migrations automaticas):

```powershell
docker cp "D:\api de pagamento\ventrasim\drizzle\0000_spicy_ultimates.sql" apidepagamento-db-1:/var/lib/postgresql/data/0000_spicy_ultimates.sql
docker exec -i apidepagamento-db-1 psql -U escrow -d escrow -f /var/lib/postgresql/data/0000_spicy_ultimates.sql
```

### Cadastrar secret do webhook

```powershell
docker exec -i apidepagamento-db-1 psql -U escrow -d escrow -c "insert into webhook_endpoints (env, secret, is_active) values ('sandbox','<your-secret>',true) on conflict (env) do update set secret = excluded.secret, is_active = true;"
```

### Endpoint de recebimento

`POST /api/webhooks/ventra/[env]` onde `env` = `local|sandbox|staging`

- Usa raw body para assinatura HMAC SHA-256
- Salva sempre em `webhook_events` (idempotente por `event_id`)
- Salva tentativas em `webhook_deliveries`
- Responde sempre `200 { ok: true }`

### Enviar webhook (PowerShell)

```powershell
$payload='{"id":"evt_003","type":"order.paid","created_at":"2026-01-25T18:00:00Z","order_id":"ord_123"}'
$secret='<your-secret>'
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$hashBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payload))
$signature = ($hashBytes | ForEach-Object { $_.ToString('x2') }) -join ''

Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3001/api/webhooks/ventra/sandbox" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ "X-Signature" = $signature } `
  -Body $payload
```

### Ver eventos no banco

```powershell
docker exec -i apidepagamento-db-1 psql -U escrow -d escrow -c "select id, event_id, env, event_type, order_id, signature_ok, received_at, delta_ms from webhook_events order by received_at desc limit 5;"
docker exec -i apidepagamento-db-1 psql -U escrow -d escrow -c "select id, event_id, attempt_number, status, received_at from webhook_deliveries order by received_at desc limit 5;"
```

### UI de eventos (VentraSim)

- `http://localhost:3001/events`
- Lista eventos e abre drawer com payload/headers/timeline.

## Troubleshooting

- `alembic` nao reconhecido: use `python -m alembic ...`
- Erro `psycopg` no Windows: use `psycopg2-binary` e URL `postgresql+psycopg2://...`
- Porta 3000 em uso: Next muda para 3001/3002 (ver log)
- Webhook sem gravar: confirme `DATABASE_URL` no mesmo terminal do `npm run dev`
