# Ventra + VentraSim

Sistema de **escrow com Pix** orientado a eventos, acompanhado de um **merchant simulator** completo para validar integrações reais via webhook — inspirado em plataformas como Stripe, Adyen e Mercado Pago.

> Este projeto **não é um checkout fake** e **não é um mock**.
> Ele existe para provar, tecnicamente, que o Ventra funciona como **plataforma de pagamentos integrável**, resiliente a falhas reais de rede e entrega.

---

## 🎯 Objetivo do projeto

O Ventra foi criado para estudar e demonstrar:

- Arquitetura de **pagamentos orientada a eventos**
- Fluxos de **escrow** (custódia → liberação)
- **Webhooks assinados**, idempotentes e tolerantes a falhas
- Separação clara entre **plataforma** e **merchant**
- Observabilidade de eventos, retries e latência

Tudo isso em ambiente **sandbox**, mas com decisões arquiteturais **100% aplicáveis em produção**.

---

## 🧩 Componentes

### Ventra (core)
Plataforma de pagamentos / escrow.

Responsável por:
- Criar pedidos de escrow
- Processar pagamento Pix (sandbox)
- Manter o **ledger soberano**
- Emitir eventos via webhook

**Stack:**
- Python
- PostgreSQL

---

### VentraSim (merchant simulator)
Cliente oficial de integração com o Ventra.

Responsável por:
- Criar pedidos sandbox no Ventra
- Receber webhooks assinados
- Validar assinatura (HMAC SHA256)
- Registrar eventos e tentativas de entrega
- Simular falhas reais de entrega
- Exibir timeline completa de eventos

**Stack:**
- Next.js (App Router)
- Drizzle ORM
- PostgreSQL

> O VentraSim representa como um **merchant real** integraria o Ventra.

---

## 🧠 Filosofia de design

### Eventos são a fonte da verdade

- Eventos **nunca são descartados**
- Mesmo eventos com assinatura inválida são salvos
- Falhas fazem parte do sistema e precisam ser visíveis

Isso permite:
- Debug realista
- Auditoria
- Observação de retries

---

### Ledger soberano

O VentraSim:
- ❌ não calcula dinheiro
- ❌ não mantém saldo próprio
- ❌ não decide estado financeiro

Estados exibidos vêm de:
- eventos recebidos
- ou consultas ao Ventra

> O ledger do Ventra é sempre a verdade final.

---

### Idempotência correta

- Cada evento possui `event_id`
- Eventos duplicados:
  - não criam novo evento
  - apenas registram nova tentativa (retry)

Isso permite observar:
- retries automáticos
- duplicações
- atrasos entre tentativas

---

## 🔐 Webhooks

### Endpoint

```
POST /api/webhooks/ventra/:env
```

Ambientes:
- local
- sandbox
- staging

---

### Assinatura

- Header: `X-Signature`
- Algoritmo: `HMAC-SHA256`
- Payload usado: **raw body**

Regras:
- Comparação em constant-time
- Evento é salvo mesmo se a assinatura falhar
- Eventos inválidos aparecem como **SIG FAIL** na UI

---

## 🧪 Simulação de falhas

O VentraSim permite simular comportamentos reais de delivery:

- **normal** → responde `200`
- **offline** → responde `503` imediatamente
- **timeout** → segura a resposta até o cliente estourar timeout

Cada tentativa gera:
- registro próprio
- latência real
- modo usado no momento

Isso permite validar:
- comportamento de retry do Ventra
- backoff
- resiliência da integração

---

## 🖥️ Interface (UX)

### Tela `/events`

Timeline de eventos com:
- tipo do evento (ex: `charge.paid`)
- `order_id`
- badges:
  - `SIG OK` / `SIG FAIL`
  - `RETRY N`
  - `Δ +Xs` (delay)

---

### Drawer de detalhes

Ao clicar em um evento:

- resumo
- payload (JSON)
- headers assinados
- timeline de tentativas

Inspirado diretamente no **Stripe Dashboard**.

---

### Tela `/orders`

- Lista pedidos criados no Ventra
- Status atualizado automaticamente via webhook

### Tela `/orders/[orderId]`

- Detalhes do pedido
- Estado refletindo o ledger do Ventra

---

## 🔁 Fluxo end-to-end validado

1. Criar pedido no VentraSim
2. Ventra cria escrow sandbox
3. Pagamento e liberação simulados
4. Ventra emite webhooks
5. VentraSim recebe eventos
6. UI reflete estado real do pedido

---

## 🚀 Próximos passos (fora do MVP)

- Merchant settings completo
- Múltiplos endpoints e secrets
- Retry manual
- Analytics de entrega
- Release / refund via UI

Essas evoluções serão consideradas **após** o MVP estar sólido.

---

## ⚠️ O que este projeto NÃO é

- ❌ Marketplace real
- ❌ Pix real
- ❌ Painel financeiro completo
- ❌ Sistema de analytics avançado

Esses pontos estão **fora do escopo propositalmente**.

---

## 🧪 Status

✔️ MVP funcional
✔️ Fluxo completo validado
✔️ Arquitetura pronta para evoluir

---

## 🏁 Conclusão

O Ventra + VentraSim existem para provar que:

> Uma plataforma de pagamentos só é real quando alguém consegue integrá-la, quebrá-la e observá-la.

Este projeto foca exatamente nisso.

