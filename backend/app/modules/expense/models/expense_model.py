import enum
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class CashEntryType(str, enum.Enum):
    TOPUP = "topup"      # cash added to the petty-cash float (imprest)
    EXPENSE = "expense"  # cash spent


class CashEntry(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """One line in the petty-cash ledger. Balance = sum(topups) - sum(expenses)."""

    __tablename__ = "cash_entries"

    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=True, index=True
    )
    entry_type: Mapped[CashEntryType] = mapped_column(
        Enum(CashEntryType, name="cash_entry_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    paid_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
