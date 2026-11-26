"""Cost rates and the usage ledger.

``usage_records`` is owned by the generation domain (B-05 wrote the first
version); B-06 extends it into the single billing ledger instead of introducing
a second cost table.  One attempt can therefore have at most one ledger row.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CostRate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Price snapshot used when a provider call is recorded.

    ``model_code=''`` is the capability wildcard; an exact model row wins over it.
    """

    __tablename__ = "cost_rates"
    __table_args__ = (
        UniqueConstraint(
            "provider_code",
            "model_code",
            "capability",
            "effective_from",
            name="uq_cost_rates_scope_effective",
        ),
    )

    provider_code: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    model_code: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    capability: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    unit: Mapped[str] = mapped_column(String(40), nullable=False, default="call")
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="CNY")
    failure_ratio: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), nullable=False, default=Decimal("0.5000")
    )
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


# The ledger columns live on ``generation.models.UsageRecord`` so providers and
# tests keep one import path.  This module re-exports the entity for cost code.
COST_UNITS = ("call", "second", "1k_tokens", "image")
