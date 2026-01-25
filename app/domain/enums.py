from __future__ import annotations

from enum import Enum


class OrderStatus(str, Enum):
    CREATED = "CREATED"
    AWAITING_PAYMENT = "AWAITING_PAYMENT"
    PAID_IN_ESCROW = "PAID_IN_ESCROW"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"
    DISPUTED = "DISPUTED"
    RESOLVED = "RESOLVED"


class ChargeStatus(str, Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    EXPIRED = "EXPIRED"
    CANCELED = "CANCELED"


class LedgerDirection(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class LedgerAccount(str, Enum):
    CUSTOMER = "CUSTOMER"
    ESCROW = "ESCROW"
    MERCHANT = "MERCHANT"


class LedgerEntryType(str, Enum):
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    ESCROW_HELD = "ESCROW_HELD"
    RELEASED_TO_MERCHANT = "RELEASED_TO_MERCHANT"
    REFUNDED_TO_CUSTOMER = "REFUNDED_TO_CUSTOMER"
