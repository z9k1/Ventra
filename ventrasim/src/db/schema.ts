import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const envEnum = pgEnum('ventra_env', ['local', 'sandbox', 'staging'])

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: serial('id').primaryKey(),
    env: text('env').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    deliveryMode: text('delivery_mode').notNull().default('normal'),
    timeoutMs: integer('timeout_ms').notNull().default(15000),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  }
)

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: text('event_id').notNull().unique(),
    env: envEnum('env').notNull(),
    eventType: text('event_type').notNull(),
    orderId: text('order_id').notNull(),
    signatureOk: boolean('signature_ok').notNull(),
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    deltaMs: integer('delta_ms'),
    payloadJson: jsonb('payload_json').notNull(),
    headersJson: jsonb('headers_json').notNull()
  },
  (table) => ({
    orderIdIdx: index('webhook_events_order_id_idx').on(table.orderId)
  })
)

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => webhookEvents.eventId, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    modeUsed: text('mode_used'),
    latencyMs: integer('latency_ms'),
    endpointId: integer('endpoint_id').references(() => webhookEndpoints.id),
    endpointUrlSnapshot: text('endpoint_url_snapshot'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    eventAttemptIdx: index('webhook_deliveries_event_attempt_idx').on(table.eventId, table.attemptNumber)
  })
)

export const ventraSimOrders = pgTable(
  'ventrasim_orders',
  {
    id: integer('id').primaryKey(),
    env: text('env').notNull(),
    orderId: text('order_id').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').default('BRL'),
    status: text('status').notNull(),
    chargeId: text('charge_id'),
    txid: text('txid'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    envOrderUnique: index('ventrasim_orders_env_order_id_key')
      .on(table.env, table.orderId)
      .unique()
  })
)
