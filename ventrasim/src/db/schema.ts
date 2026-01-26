import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const envEnum = pgEnum('ventra_env', ['local', 'sandbox', 'staging'])

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    env: envEnum('env').notNull().unique(),
    secret: text('secret').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
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
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    eventAttemptIdx: index('webhook_deliveries_event_attempt_idx').on(table.eventId, table.attemptNumber)
  })
)
