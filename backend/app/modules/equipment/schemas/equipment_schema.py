import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.equipment.models.equipment_model import EquipmentOwnership, EquipmentStatus


class EquipmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    rental_rate: float = Field(0, ge=0)
    notes: Optional[str] = None


class EquipmentCreate(EquipmentBase):
    ownership: EquipmentOwnership = EquipmentOwnership.OWNED
    status: EquipmentStatus = EquipmentStatus.AVAILABLE


class EquipmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=50)
    ownership: Optional[EquipmentOwnership] = None
    status: Optional[EquipmentStatus] = None
    rental_rate: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class EquipmentOut(EquipmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    ownership: EquipmentOwnership
    status: EquipmentStatus
    created_at: datetime
    updated_at: datetime


class EquipmentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    category: Optional[str] = None
    ownership: EquipmentOwnership
    status: EquipmentStatus
    rental_rate: float


class PaginatedEquipment(BaseModel):
    items: List[EquipmentListItem]
    total: int
    page: int
    page_size: int


class UsageCreate(BaseModel):
    equipment_id: uuid.UUID
    usage_date: date
    quantity: float = Field(..., gt=0)
    cost: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class UsageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    equipment_id: uuid.UUID
    site_id: uuid.UUID
    usage_date: date
    quantity: float
    cost: float
    notes: Optional[str] = None
    created_at: datetime


class SiteEquipmentCostItem(BaseModel):
    equipment_id: uuid.UUID
    equipment_name: str
    equipment_code: str
    total_quantity: float
    total_cost: float


class MaintenanceCreate(BaseModel):
    service_date: date
    description: str = Field(..., min_length=1, max_length=255)
    cost: float = Field(0, ge=0)
    notes: Optional[str] = None


class MaintenanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    equipment_id: uuid.UUID
    service_date: date
    description: str
    cost: float
    notes: Optional[str] = None
    created_at: datetime
