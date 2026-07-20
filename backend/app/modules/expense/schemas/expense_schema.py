import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.expense.models.expense_model import CashEntryType


class CashEntryCreate(BaseModel):
    site_id: Optional[uuid.UUID] = None
    entry_type: CashEntryType
    category: Optional[str] = Field(None, max_length=50)
    amount: float = Field(..., gt=0)
    entry_date: date
    paid_to: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def _expense_needs_category(self) -> "CashEntryCreate":
        if self.entry_type == CashEntryType.EXPENSE and not (self.category and self.category.strip()):
            raise ValueError("An expense needs a category")
        return self


class CashEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    entry_type: CashEntryType
    category: Optional[str] = None
    amount: float
    entry_date: date
    paid_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class ExpenseCategoryRow(BaseModel):
    category: str
    amount: float


class PettyCashSummary(BaseModel):
    total_topup: float
    total_expense: float
    balance: float
    expense_by_category: List[ExpenseCategoryRow]
