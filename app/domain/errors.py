from __future__ import annotations


class DomainError(Exception):
    status_code = 400
    detail = "Domain error"

    def __init__(self, detail: str | None = None):
        if detail:
            self.detail = detail
        super().__init__(self.detail)


class NotFoundError(DomainError):
    status_code = 404
    detail = "Not found"


class InvalidStateError(DomainError):
    status_code = 409
    detail = "Invalid state"


class IdempotencyConflictError(DomainError):
    status_code = 409
    detail = "Idempotency conflict"


class ChargeExpiredError(DomainError):
    status_code = 410
    detail = "Charge expired"
