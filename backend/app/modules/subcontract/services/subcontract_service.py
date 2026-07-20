import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.subcontract.exceptions import (
    DuplicateSubcontractorCodeError,
    DuplicateWorkOrderNumberError,
    SubcontractorNotFoundError,
    WorkOrderNotFoundError,
)
from app.modules.subcontract.models.subcontract_model import (
    Subcontractor,
    SubcontractorStatus,
    WorkOrder,
    WorkOrderPayment,
    WorkOrderStatus,
)
from app.modules.subcontract.repositories.subcontract_repository import (
    SubcontractorRepository,
    WorkOrderRepository,
)
from app.modules.subcontract.schemas.subcontract_schema import (
    PaginatedSubcontractors,
    PaginatedWorkOrders,
    SubcontractorCreate,
    SubcontractorUpdate,
    WorkOrderCreate,
    WorkOrderListRow,
    WorkOrderPaymentCreate,
    WorkOrderUpdate,
)


def _paid(wo: WorkOrder) -> float:
    return round(sum(float(p.amount) for p in wo.payments), 2)


class SubcontractorService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SubcontractorRepository(db)

    def create(self, org_id, created_by, payload: SubcontractorCreate) -> Subcontractor:
        if self.repo.get_by_code(org_id, payload.code) is not None:
            raise DuplicateSubcontractorCodeError(payload.code)
        sub = Subcontractor(org_id=org_id, created_by=created_by, **payload.model_dump())
        sub = self.repo.create(sub)
        self.db.commit()
        self.db.refresh(sub)
        return sub

    def get(self, org_id, sub_id) -> Subcontractor:
        sub = self.repo.get_by_id(org_id, sub_id)
        if sub is None:
            raise SubcontractorNotFoundError(sub_id)
        return sub

    def list(self, org_id, page=1, page_size=20, status=None) -> PaginatedSubcontractors:
        items, total = self.repo.list(org_id, page=page, page_size=page_size, status=status)
        return PaginatedSubcontractors(items=items, total=total, page=page, page_size=page_size)

    def update(self, org_id, sub_id, payload: SubcontractorUpdate) -> Subcontractor:
        sub = self.get(org_id, sub_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(sub, field, value)
        self.db.commit()
        self.db.refresh(sub)
        return sub

    def archive(self, org_id, sub_id) -> None:
        sub = self.get(org_id, sub_id)
        sub.status = SubcontractorStatus.INACTIVE
        self.repo.soft_delete(sub)
        self.db.commit()


class WorkOrderService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = WorkOrderRepository(db)
        self.sub_repo = SubcontractorRepository(db)

    def create(self, org_id, created_by, payload: WorkOrderCreate) -> WorkOrder:
        if self.repo.get_by_number(org_id, payload.wo_number) is not None:
            raise DuplicateWorkOrderNumberError(payload.wo_number)
        if self.sub_repo.get_by_id(org_id, payload.subcontractor_id) is None:
            raise SubcontractorNotFoundError(payload.subcontractor_id)
        wo = WorkOrder(
            org_id=org_id, created_by=created_by, status=WorkOrderStatus.OPEN, **payload.model_dump()
        )
        wo = self.repo.create(wo)
        self.db.commit()
        return self.repo.get_by_id(org_id, wo.id)

    def get(self, org_id, wo_id) -> WorkOrder:
        wo = self.repo.get_by_id(org_id, wo_id)
        if wo is None:
            raise WorkOrderNotFoundError(wo_id)
        return wo

    def list(
        self, org_id, page=1, page_size=20, site_id=None, status=None
    ) -> PaginatedWorkOrders:
        wos, total = self.repo.list(
            org_id, page=page, page_size=page_size, site_id=site_id, status=status
        )
        items = [
            WorkOrderListRow(
                id=wo.id,
                wo_number=wo.wo_number,
                site_id=wo.site_id,
                subcontractor_id=wo.subcontractor_id,
                title=wo.title,
                wo_value=float(wo.wo_value),
                total_paid=_paid(wo),
                balance=round(float(wo.wo_value) - _paid(wo), 2),
                progress_percent=float(wo.progress_percent),
                status=wo.status,
            )
            for wo in wos
        ]
        return PaginatedWorkOrders(items=items, total=total, page=page, page_size=page_size)

    def update(self, org_id, wo_id, payload: WorkOrderUpdate) -> WorkOrder:
        wo = self.get(org_id, wo_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(wo, field, value)
        self.db.commit()
        return self.repo.get_by_id(org_id, wo_id)

    def delete(self, org_id, wo_id) -> None:
        wo = self.get(org_id, wo_id)
        self.repo.soft_delete(wo)
        self.db.commit()

    def add_payment(self, org_id, wo_id, payload: WorkOrderPaymentCreate) -> WorkOrder:
        wo = self.get(org_id, wo_id)
        wo.payments.append(
            WorkOrderPayment(
                amount=payload.amount, payment_date=payload.payment_date, notes=payload.notes
            )
        )
        self.db.commit()
        return self.repo.get_by_id(org_id, wo_id)
