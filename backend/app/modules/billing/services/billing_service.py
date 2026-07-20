import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.billing.exceptions import (
    ClientBillNotFoundError,
    DuplicateBillNumberError,
)
from app.modules.billing.models.billing_model import BillStatus, ClientBill
from app.modules.billing.repositories.billing_repository import BillingRepository
from app.modules.billing.schemas.billing_schema import (
    ClientBillCreate,
    ClientBillingSummary,
    ClientBillListRow,
    ClientBillUpdate,
    PaginatedClientBills,
)


def net_payable(bill: ClientBill) -> float:
    gross = float(bill.gross_amount)
    retention = gross * float(bill.retention_percent) / 100
    tds = gross * float(bill.tds_percent) / 100
    return round(gross - retention - tds - float(bill.other_deductions), 2)


class BillingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = BillingRepository(db)

    def create_bill(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: ClientBillCreate
    ) -> ClientBill:
        if self.repo.get_by_number(org_id, payload.bill_number) is not None:
            raise DuplicateBillNumberError(payload.bill_number)
        bill = ClientBill(
            org_id=org_id, created_by=created_by, status=BillStatus.DRAFT, **payload.model_dump()
        )
        bill = self.repo.create(bill)
        self.db.commit()
        self.db.refresh(bill)
        return bill

    def get_bill(self, org_id: uuid.UUID, bill_id: uuid.UUID) -> ClientBill:
        bill = self.repo.get_by_id(org_id, bill_id)
        if bill is None:
            raise ClientBillNotFoundError(bill_id)
        return bill

    def list_bills(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        site_id: Optional[uuid.UUID] = None,
        status: Optional[BillStatus] = None,
    ) -> PaginatedClientBills:
        bills, total = self.repo.list(
            org_id, page=page, page_size=page_size, site_id=site_id, status=status
        )
        items = [
            ClientBillListRow(
                id=b.id,
                site_id=b.site_id,
                bill_number=b.bill_number,
                bill_date=b.bill_date,
                gross_amount=float(b.gross_amount),
                net_payable=net_payable(b),
                status=b.status.value,
            )
            for b in bills
        ]
        return PaginatedClientBills(items=items, total=total, page=page, page_size=page_size)

    def update_bill(
        self, org_id: uuid.UUID, bill_id: uuid.UUID, payload: ClientBillUpdate
    ) -> ClientBill:
        bill = self.get_bill(org_id, bill_id)
        updates = payload.model_dump(exclude_unset=True)
        if "status" in updates and updates["status"] is not None:
            updates["status"] = BillStatus(updates["status"])
        for field, value in updates.items():
            setattr(bill, field, value)
        self.db.commit()
        self.db.refresh(bill)
        return bill

    def delete_bill(self, org_id: uuid.UUID, bill_id: uuid.UUID) -> None:
        bill = self.get_bill(org_id, bill_id)
        self.repo.soft_delete(bill)
        self.db.commit()

    def summary(
        self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None
    ) -> ClientBillingSummary:
        bills = self.repo.all_for_summary(org_id, site_id=site_id)
        total_gross = round(sum(float(b.gross_amount) for b in bills), 2)
        total_net = round(sum(net_payable(b) for b in bills), 2)
        total_paid = round(
            sum(net_payable(b) for b in bills if b.status == BillStatus.PAID), 2
        )
        total_outstanding = round(
            sum(
                net_payable(b)
                for b in bills
                if b.status in (BillStatus.SUBMITTED, BillStatus.CERTIFIED)
            ),
            2,
        )
        return ClientBillingSummary(
            total_gross=total_gross,
            total_net=total_net,
            total_paid=total_paid,
            total_outstanding=total_outstanding,
            bill_count=len(bills),
        )
