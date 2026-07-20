import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class BudgetLineCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    budgeted_amount: float = Field(..., ge=0)
    notes: Optional[str] = None


class BudgetLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    category: str
    description: Optional[str] = None
    budgeted_amount: float
    notes: Optional[str] = None
    created_at: datetime


class BudgetCategoryRow(BaseModel):
    category: str
    budgeted: float


class SiteBudgetSummary(BaseModel):
    site_id: uuid.UUID
    total_budgeted: float
    budget_by_category: List[BudgetCategoryRow]
    actual_material: float
    actual_labour: float
    actual_invoices: float
    actual_total: float
    variance: float  # total_budgeted - actual_total (positive = under budget)
    percent_used: float  # actual_total / total_budgeted * 100 (0 if no budget)
