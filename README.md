---

# Ventra + VentraSim

Plataforma de **escrow com Pix orientada a eventos**, acompanhada de um **merchant simulator** completo para validar integrações reais via webhook — inspirada em soluções como Stripe, Adyen e Mercado Pago.

> Este projeto **não é um checkout fake** e **não é um mock**.
> Ele existe para provar, tecnicamente, que o Ventra funciona como uma **plataforma de pagamentos integrável**, resiliente a falhas reais de rede e entrega.

---

## O que este projeto demonstra

Este projeto foca em **realismo de integração**, não em UI bonita ou fluxos artificiais.

Ele demonstra:

* Arquitetura de pagamentos **orientada a eventos**
* Fluxos de **escrow** (custódia → liberação)
* **Webhooks assinados e idempotentes**
* Retry automático e **retry manual (estilo Stripe)**
* Observabilidade de latência e tentativas de entrega
* Simulação de falhas reais (offline / timeout)
* Separação clara entre **plataforma** e **merchant**

Tudo em ambiente **sandbox**, mas com decisões arquiteturais **aplicáveis em produção**.

---

## Visão geral da arquitetura

```
Ventra (Plataforma de Escrow)
        |
        |  Webhooks assinados (HMAC)
        v
VentraSim (Merchant Simulator)
```

* O Ventra é a **fonte soberana da verdade**
* O VentraSim representa uma **integração real de merchant**

---

## Componentes

### Ventra — Core de Escrow

Plataforma de pagamentos / escrow.

Responsável por:

* Criar pedidos de escrow
* Simular pagamentos Pix (sandbox)
* Manter o **ledger soberano**
* Emitir eventos de domínio via webhook

**Stack**

* Python
* PostgreSQL

---

### VentraSim — Merchant Simulator

Cliente oficial de integração com o Ventra.

Responsável por:

* Criar pedidos sandbox no Ventra
* Receber webhooks assinados
* Validar assinatura (HMAC SHA256)
* Garantir idempotência por `event_id`
* Registrar **todas** as tentativas de entrega
* Simular falhas reais de delivery
* Exibir timeline completa de eventos e retries

**Stack**

* Next.js (App Router)
* Drizzle ORM
* PostgreSQL

> O VentraSim simula exatamente como um **merchant real** integraria o Ventra.

---

## Princípios de design

### Eventos nunca são descartados

* Todo webhook é persistido
* Assinaturas inválidas **não são ignoradas**
* Falhas fazem parte do sistema e precisam ser visíveis

Isso permite:

* Debug realista
* Auditoria completa
* Observação de retries

---

### Ledger soberano

O VentraSim:

* ❌ não calcula saldo
* ❌ não decide estado financeiro
* ❌ não “corrige” estados

Os estados exibidos vêm:

* dos eventos recebidos
* ou de consultas diretas ao Ventra

> O ledger do Ventra é sempre a verdade final.

---

### Idempotência correta

* Cada evento possui `event_id`
* Eventos duplicados:

  * não criam novos eventos
  * apenas novas **tentativas de entrega**

Isso permite observar:

* retries automáticos
* duplicações
* atrasos entre tentativas

---

## Webhooks

### Endpoint de recebimento

```
POST /api/webhooks/ventra/:env
```

Ambientes:

* `local`
* `sandbox`
* `staging`

---

### Assinatura

* Header: `X-Signature`
* Algoritmo: `HMAC-SHA256`
* Payload: **raw body**

Regras:

* Comparação em constant-time
* Evento salvo mesmo se a assinatura falhar
* Eventos inválidos aparecem como **SIG FAIL** na UI

---

## Configuração rápida (dev)

### Ventra (backend)

Valores básicos no `.env`:

```
API_KEY=dev-secret
WEBHOOK_URL=http://localhost:3001/api/webhooks/ventra/sandbox
WEBHOOK_SECRET=dev-webhook-secret
VENTRASIM_BASE_URL=http://localhost:3001
VENTRA_INTERNAL_TOKEN=dev-internal-token
```

### Ventra UI (frontend)

O frontend envia `x-api-base-url` e `x-api-key` via `/api/proxy`.
Agora existe rotação de API key:

```
POST /settings/api-key
```

- Requer autenticação com a **API key atual**.
- A nova key fica salva em `.runtime/api_key.json` (apague o arquivo para voltar ao `.env`).

### VentraSim (merchant simulator)

Na tela `/events`, o bloco **Conexão com Ventra** salva localmente:

- `x-api-base-url`
- `x-api-key`

Esses headers são enviados nas chamadas `/api/dev` (create/release/refund),
garantindo que o VentraSim use a mesma chave configurada no Ventra.

### Webhook secret (SIG OK)

O secret salvo no endpoint do VentraSim precisa bater com o secret usado pelo Ventra
(`WEBHOOK_SECRET` ou o secret resolvido via VentraSim). Caso contrário, aparece **SIG FAIL**.

---

## Simulação de falhas de entrega

O VentraSim permite simular comportamentos reais de rede:

| Modo    | Comportamento                   |
| ------- | ------------------------------- |
| normal  | Responde `200 OK`               |
| offline | Responde `503` imediatamente    |
| timeout | Segura a resposta até o timeout |

Cada tentativa registra:

* número da tentativa
* latência real
* modo ativo no momento
* snapshot do endpoint

---

## Retry manual (estilo Stripe)

O VentraSim suporta **retry manual de webhooks**:

* Reenvia o payload original
* Reassina com a secret do endpoint ativo
* Cria nova tentativa de entrega
* Mantém idempotência (evento não duplica)

Metadados retornados:

* número da tentativa
* status HTTP
* latência
* `delivery_id`

---

## Interface (UX)

### `/events`

Timeline de eventos com:

* tipo do evento (ex: `charge.created`)
* `order_id`
* badges:

  * `SIG OK / SIG FAIL`
  * `RETRY N`
  * `Δ +Xs`

---

### Drawer de evento

Ao clicar em um evento:

* payload (JSON)
* headers assinados
* timeline de tentativas
* botão de retry manual

Inspirado diretamente no **Stripe Dashboard**.

---

### `/orders`

* Lista de pedidos criados no Ventra
* Status atualizado exclusivamente via webhooks

### `/orders/[orderId]`

* Detalhes do pedido
* Estado refletindo o ledger do Ventra

---

## Fluxo end-to-end validado

1. Criar pedido no VentraSim
2. Ventra cria escrow sandbox
3. Pagamento e liberação simulados
4. Ventra emite eventos via webhook
5. VentraSim recebe e valida
6. UI reflete o estado real

---

## Fora do escopo (intencionalmente)

* ❌ Pix real
* ❌ Marketplace
* ❌ Analytics avançado
* ❌ Dashboard financeiro
* ❌ Multi-merchant SaaS

Esses pontos pertencem a um **produto comercial**, não a um simulador técnico.

---

## Status do projeto

✔️ Fluxo completo validado
✔️ Retry manual implementado
✔️ Simulação de falhas funcional
✔️ Arquitetura pronta para evoluir

---

## Conclusão

O Ventra + VentraSim existem para provar que:

> Uma plataforma de pagamentos só é real quando alguém consegue integrá-la, quebrá-la, fazer retry e entender exatamente o que aconteceu.

Este projeto foca exatamente nisso.

---
<img width="427" height="958" alt="image" src="https://github.com/user-attachments/assets/7669f550-8708-4be9-92f8-969978944681" />
<img width="1866" height="959" alt="image" src="https://github.com/user-attachments/assets/5968ef04-bff5-46c2-a1d8-fb620031ea36" />
<img width="426" height="958" alt="image" src="https://github.com/user-attachments/assets/6028763f-d1e5-4682-b325-2e1da7ba5e0c" />
<img width="1863" height="966" alt="image" src="https://github.com/user-attachments/assets/1723de1d-df21-487c-a949-09a73fdfc662" />



