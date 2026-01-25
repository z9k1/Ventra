"""initial

Revision ID: 0001_initial
Revises: 
Create Date: 2026-01-25 12:00:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "charges",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", sa.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pix_emv", sa.Text(), nullable=False),
        sa.Column("txid", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", sa.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("direction", sa.String(), nullable=False),
        sa.Column("account", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
    )
    op.create_table(
        "idempotency_keys",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("endpoint", sa.String(), nullable=False),
        sa.Column("request_hash", sa.String(), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("key", "endpoint", name="pk_idempotency_keys"),
    )
    op.create_table(
        "webhook_subscriptions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("secret", sa.String(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("webhook_subscriptions")
    op.drop_table("idempotency_keys")
    op.drop_table("ledger_entries")
    op.drop_table("charges")
    op.drop_table("orders")
