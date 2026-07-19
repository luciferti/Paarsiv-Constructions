import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.material.models.material_model import MaterialEntryType, MaterialStatus


class MaterialBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    unit: str = Field(..., min_length=1, max_length=20)
    category: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class MaterialCreate(MaterialBase):
    status: MaterialStatus = MaterialStatus.ACTIVE


class MaterialUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    category: Optional[str] = Field(None, max_length=50)
    status: Optional[MaterialStatus] = None
    notes: Optional[str] = None


class MaterialOut(MaterialBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    status: MaterialStatus
    created_at: datetime
    updated_at: datetime


class MaterialListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    unit: str
    category: Optional[str] = None
    status: MaterialStatus


class PaginatedMaterials(BaseModel):
    items: List[MaterialListItem]
    total: int
    page: int
    page_size: int


class MaterialEntryCreate(BaseModel):
    material_id: uuid.UUID
    vendor_id: Optional[uuid.UUID] = None
    entry_type: MaterialEntryType
    quantity: float = Field(..., gt=0)
    unit_cost: Optional[float] = Field(None, ge=0)
    entry_date: date
    notes: Optional[str] = None


class MaterialEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    material_id: uuid.UUID
    vendor_id: Optional[uuid.UUID] = None
    entry_type: MaterialEntryType
    quantity: float
    unit_cost: Optional[float] = None
    entry_date: date
    notes: Optional[str] = None
    created_at: datetime


class SiteMaterialStockItem(BaseModel):
    material_id: uuid.UUID
    material_name: str
    material_code: str
    unit: str
    quantity_received: float
    quantity_used: float
    quantity_adjusted: float
    quantity_on_hand: float
