# Escrow Pix API (Sandbox) + Ventra Frontend

Este repo tem dois projetos:

- Backend: FastAPI + PostgreSQL. Simula fluxo de Pix em sandbox com custodia (escrow).
- Frontend: Next.js (Ventra style) para operar o fluxo (Novo Deposito -> Pix -> Simular pagamento -> Release/Refund).

## O que o sistema faz

Fluxo principal (sandbox):

1) Voce cria uma Order com um valor (ex: R$ 14,00).
2) Voce gera uma cobranca Pix (Charge) com expiracao (default 15 min) e um `pix_emv` fake.
3) Em sandbox, voce pode chamar `simulate-paid` para confirmar o pagamento.
4) O dinheiro fica em custodia (ESCROW) e depois pode ser:
   - liberado ao merchant (`release`), ou
   - reembolsado ao customer (`refund`).

Regras importantes:

- Ledger append-only: o saldo nao e atualizado diretamente; e derivado da soma das entradas do ledger.
- Maquina de estados rigida para Order e Charge (sem pular estados).
- Idempotencia via header `Idempotency-Key` em endpoints POST criticos.
- Webhooks assinados com HMAC SHA-256 via header `X-Signature`.

## Requisitos

- Python 3.11+
- Docker Desktop (para o Postgres via docker compose)
- Node + pnpm (para o frontend)

## 1) Subir o Postgres (Docker)

Na raiz do repo:

```bash
docker compose up -d
```

Isso sobe um Postgres em `localhost:5432` com user/pass/db `escrow` (veja `docker-compose.yml`).

## 2) Configurar env do backend

Crie um arquivo `.env` (copie de `.env.example`) e ajuste se quiser:

- `DATABASE_URL`
- `API_KEY`
- `ENV=sandbox`

No PowerShell, voce tambem pode exportar as env vars so para o terminal atual:

```powershell
$env:DATABASE_URL="postgresql+psycopg2://escrow:escrow@localhost:5432/escrow"
$env:API_KEY="YOUR_API_KEY"
$env:ENV="sandbox"
```

## 3) Rodar migrations (Alembic)

No Windows, pode ser que `alembic` nao esteja no PATH. Use:

```powershell
python -m alembic upgrade head
```

## 4) Rodar o backend

```powershell
uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

## 5) Rodar o frontend (Ventra UI)

```powershell
cd frontend
pnpm install
pnpm dev
```

O Next vai subir em `http://localhost:3000` (ou outra porta se 3000 estiver ocupada).

### Configurar a UI

Abra `http://localhost:3000/settings` e configure:

- `API_BASE_URL`: `http://localhost:8000`
- `API_KEY`: `YOUR_API_KEY`

A UI chama sempre o proxy interno do Next (`/api/proxy/...`) para evitar CORS.

## Demo flow (end-to-end)

1) Backend rodando (`:8000`) e Postgres rodando.
2) Frontend rodando (`:3000`).
3) Em `/settings`, clique em "Testar conexao" (GET `/balance`).
4) Em `/dashboard`:
   - Clique `+ Novo Deposito`
   - Informe o valor e confirme
   - Vai aparecer a etapa "Cobranca Pix" com `pix_emv` + countdown
   - Clique `Simular pagamento` (sandbox)
   - Quando o status for `PAID_IN_ESCROW`, use `Release` ou `Refund`
5) Veja:
   - saldos em `/dashboard` (GET `/balance`)
   - ledger do pedido em `/wallet`

## API (principais endpoints)

Auth: enviar `X-API-KEY: <API_KEY>` em todas as chamadas.

- POST `/orders` { amount_cents, currency }
- GET `/orders/{order_id}`
- POST `/orders/{order_id}/charges/pix`
- POST `/charges/{charge_id}/simulate-paid` (somente `ENV=sandbox`)
- POST `/charges/{charge_id}/cancel`
- POST `/orders/{order_id}/release`
- POST `/orders/{order_id}/refund`
- GET `/orders/{order_id}/ledger`
- GET `/balance`

### Idempotency-Key

Para POST criticos, envie `Idempotency-Key`:

- mesma key + mesmo body -> retorna a mesma resposta
- mesma key + body diferente -> 409

## Webhooks

Eventos automaticos:

- `charge.created`
- `charge.paid`
- `order.paid_in_escrow`
- `order.released`
- `order.refunded`

Assinatura:

- JSON canonical: `json.dumps(payload, sort_keys=True, separators=(",",":"))`
- `X-Signature` = hex(hmac_sha256(secret, payload_bytes))

Receptor simples (porta 9999):

```bash
python -c "from http.server import BaseHTTPRequestHandler, HTTPServer\n\nclass H(BaseHTTPRequestHandler):\n  def do_POST(self):\n    l=int(self.headers.get('Content-Length','0'))\n    b=self.rfile.read(l)\n    print('X-Signature:', self.headers.get('X-Signature'))\n    print(b.decode())\n    self.send_response(200); self.end_headers()\n\nHTTPServer(('0.0.0.0',9999),H).serve_forever()"
```

Configure `.env`:

- `WEBHOOK_URL=http://localhost:9999/hook`
- `WEBHOOK_SECRET=your_api_key`

## Troubleshooting

- Alembic nao reconhecido: use `python -m alembic ...`
- Erro psycopg (libpq) no Windows: use `psycopg2-binary` e URL `postgresql+psycopg2://...`
- Porta 3000 em uso: o Next sobe em 3001/3002 automaticamente (veja o log do `pnpm dev`)
