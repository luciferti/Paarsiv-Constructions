"""
Realistic demo-data seeder.

`seed_org(db, org_id, created_by)` populates one organization with a coherent
construction dataset across every module — sites, vendors, materials + stock,
workers + attendance, purchase orders, budgets, petty cash, client RA bills,
subcontractors + work orders + payments, equipment + usage, milestones and
daily reports. It goes through the real services, so all computed fields (wages,
PO/bill totals, budget actuals, WO balances, weighted progress) populate exactly
as they would in normal use.

Idempotent: if the org already has sites, it does nothing and returns a note,
so a "load sample data" action is safe to click twice.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Dict

from sqlalchemy.orm import Session

from app.modules.billing.schemas.billing_schema import ClientBillCreate, ClientBillUpdate
from app.modules.billing.services.billing_service import BillingService
from app.modules.budget.schemas.budget_schema import BudgetLineCreate
from app.modules.budget.services.budget_service import BudgetService
from app.modules.equipment.schemas.equipment_schema import (
    EquipmentCreate,
    MaintenanceCreate,
    UsageCreate,
)
from app.modules.equipment.services.equipment_service import (
    EquipmentService,
    MaintenanceService,
    UsageService,
)
from app.modules.expense.schemas.expense_schema import CashEntryCreate
from app.modules.expense.services.expense_service import ExpenseService
from app.modules.labour.schemas.labour_schema import AttendanceCreate, WorkerCreate
from app.modules.labour.services.labour_service import AttendanceService, WorkerService
from app.modules.material.schemas.material_schema import MaterialCreate, MaterialEntryCreate
from app.modules.material.services.material_service import (
    MaterialEntryService,
    MaterialService,
)
from app.modules.progress.schemas.progress_schema import MilestoneCreate
from app.modules.progress.services.progress_service import ProgressService
from app.modules.purchase.schemas.po_schema import (
    POLineCreate,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
)
from app.modules.purchase.services.po_service import PurchaseOrderService
from app.modules.report.schemas.report_schema import DailyReportCreate
from app.modules.report.services.report_service import ReportService
from app.modules.safety.schemas.safety_schema import IncidentCreate, IncidentUpdate
from app.modules.safety.services.safety_service import SafetyService
from app.modules.site.repositories.site_repository import SiteRepository
from app.modules.site.schemas.site_schema import SiteCreate
from app.modules.site.services.site_service import SiteService
from app.modules.subcontract.schemas.subcontract_schema import (
    SubcontractorCreate,
    WorkOrderCreate,
    WorkOrderPaymentCreate,
    WorkOrderUpdate,
)
from app.modules.subcontract.services.subcontract_service import (
    SubcontractorService,
    WorkOrderService,
)
from app.modules.vendor.schemas.vendor_schema import VendorCreate
from app.modules.vendor.services.vendor_service import VendorService


def seed_org(db: Session, org_id: uuid.UUID, created_by: uuid.UUID) -> Dict[str, object]:
    """Populate one org with demo data. No-op if it already has sites."""
    # Idempotency guard — don't double-seed an org that already has data.
    existing, _ = SiteRepository(db).list(org_id, page=1, page_size=1)
    if existing:
        return {"seeded": False, "reason": "Organization already has sites; skipped."}

    today = date.today()
    d = lambda n: today - timedelta(days=n)  # noqa: E731  n days ago

    # -- Sites --------------------------------------------------------------
    site_svc = SiteService(db)
    riverside = site_svc.create_site(org_id, created_by, SiteCreate(
        name="Riverside Tower", code="RVT-01", city="Jaipur", state="Rajasthan",
        country="India", status="active", start_date=d(120),
    ))
    metro = site_svc.create_site(org_id, created_by, SiteCreate(
        name="Metro Mall Phase 2", code="MMP-02", city="Jaipur", state="Rajasthan",
        country="India", status="active", start_date=d(60),
    ))

    # -- Vendors ------------------------------------------------------------
    ven_svc = VendorService(db)
    ultratech = ven_svc.create_vendor(org_id, created_by, VendorCreate(
        name="UltraTech Cement", code="V-UC", category="Cement", phone="9800000001"))
    tata = ven_svc.create_vendor(org_id, created_by, VendorCreate(
        name="Tata Steel", code="V-TS", category="Steel", phone="9800000002"))
    ven_svc.create_vendor(org_id, created_by, VendorCreate(
        name="Sharma Hardware", code="V-SH", category="Hardware", phone="9800000003"))

    # -- Materials + stock --------------------------------------------------
    mat_svc = MaterialService(db)
    entry_svc = MaterialEntryService(db)
    cement = mat_svc.create_material(org_id, created_by, MaterialCreate(
        name="Cement (OPC 53)", code="CEM", unit="bag", category="Structural"))
    steel = mat_svc.create_material(org_id, created_by, MaterialCreate(
        name="TMT Steel", code="STL", unit="ton", category="Structural"))
    sand = mat_svc.create_material(org_id, created_by, MaterialCreate(
        name="River Sand", code="SND", unit="cum", category="Aggregate"))

    entry_svc.add_entry(org_id, riverside.id, created_by, MaterialEntryCreate(
        material_id=cement.id, vendor_id=ultratech.id, entry_type="received",
        quantity=500, unit_cost=400, entry_date=d(30)))
    entry_svc.add_entry(org_id, riverside.id, created_by, MaterialEntryCreate(
        material_id=cement.id, entry_type="used", quantity=180, entry_date=d(10)))
    entry_svc.add_entry(org_id, riverside.id, created_by, MaterialEntryCreate(
        material_id=steel.id, vendor_id=tata.id, entry_type="received",
        quantity=8, unit_cost=55000, entry_date=d(28)))
    entry_svc.add_entry(org_id, metro.id, created_by, MaterialEntryCreate(
        material_id=sand.id, entry_type="received", quantity=40, unit_cost=1800, entry_date=d(15)))

    # -- Workers + attendance ----------------------------------------------
    wsvc = WorkerService(db)
    asvc = AttendanceService(db)
    workers = [
        wsvc.create_worker(org_id, created_by, WorkerCreate(name="Ramesh Kumar", code="W-01", trade="Mason", default_wage_rate=800)),
        wsvc.create_worker(org_id, created_by, WorkerCreate(name="Suresh Yadav", code="W-02", trade="Helper", default_wage_rate=500)),
        wsvc.create_worker(org_id, created_by, WorkerCreate(name="Vijay Singh", code="W-03", trade="Carpenter", default_wage_rate=750)),
        wsvc.create_worker(org_id, created_by, WorkerCreate(name="Anil Verma", code="W-04", trade="Electrician", default_wage_rate=900)),
    ]
    # 3 days of muster at Riverside; a couple present with overtime.
    for offset in (2, 1, 0):
        for i, w in enumerate(workers):
            status = "present" if (i + offset) % 4 != 3 else "half_day"
            ot = 2 if (i == 0 and offset == 0) else 0
            asvc.mark_attendance(org_id, riverside.id, created_by, AttendanceCreate(
                worker_id=w.id, work_date=d(offset), status=status, overtime_hours=ot))

    # -- Purchase orders ----------------------------------------------------
    po_svc = PurchaseOrderService(db)
    po1 = po_svc.create_po(org_id, created_by, PurchaseOrderCreate(
        po_number="PO-2026-101", vendor_id=ultratech.id, site_id=riverside.id, order_date=d(35),
        lines=[POLineCreate(description="Cement OPC 53", quantity=500, unit="bag", unit_price=400)]))
    po_svc.update_po(org_id, po1.id, PurchaseOrderUpdate(status="received"))
    po_svc.create_po(org_id, created_by, PurchaseOrderCreate(
        po_number="PO-2026-102", vendor_id=tata.id, site_id=riverside.id, order_date=d(20),
        lines=[POLineCreate(description="TMT Steel 12mm", quantity=8, unit="ton", unit_price=55000)]))

    # -- Budgets ------------------------------------------------------------
    bud = BudgetService(db)
    for cat, amt in [("Material", 5000000), ("Labour", 1500000), ("Equipment", 800000), ("Subcontract", 1200000)]:
        bud.add_line(org_id, riverside.id, created_by, BudgetLineCreate(category=cat, budgeted_amount=amt))
    for cat, amt in [("Material", 3000000), ("Labour", 900000)]:
        bud.add_line(org_id, metro.id, created_by, BudgetLineCreate(category=cat, budgeted_amount=amt))

    # -- Petty cash ---------------------------------------------------------
    exp = ExpenseService(db)
    exp.add_entry(org_id, created_by, CashEntryCreate(entry_type="topup", amount=50000, entry_date=d(20), paid_to="Office float"))
    for cat, amt, who in [("Transport", 2500, "Auto fare"), ("Food", 1800, "Site tea/snacks"), ("Tools", 3200, "Hardware shop"), ("Fuel", 4000, "Diesel")]:
        exp.add_entry(org_id, created_by, CashEntryCreate(entry_type="expense", category=cat, amount=amt, entry_date=d(5), paid_to=who, site_id=riverside.id))

    # -- Client RA bills ----------------------------------------------------
    bill = BillingService(db)
    b1 = bill.create_bill(org_id, created_by, ClientBillCreate(
        site_id=riverside.id, bill_number="RA-1", bill_date=d(25),
        gross_amount=4000000, retention_percent=5, tds_percent=2))
    bill.update_bill(org_id, b1.id, ClientBillUpdate(status="paid"))
    b2 = bill.create_bill(org_id, created_by, ClientBillCreate(
        site_id=riverside.id, bill_number="RA-2", bill_date=d(5),
        gross_amount=2500000, retention_percent=5, tds_percent=2))
    bill.update_bill(org_id, b2.id, ClientBillUpdate(status="submitted"))  # outstanding

    # -- Subcontractors + work orders + payments ---------------------------
    subs = SubcontractorService(db)
    wos = WorkOrderService(db)
    tiling = subs.create(org_id, created_by, SubcontractorCreate(name="Sharma Tiling Works", code="SC-01", trade="Tiling", phone="9811100001"))
    electricals = subs.create(org_id, created_by, SubcontractorCreate(name="Kumar Electricals", code="SC-02", trade="Electrical", phone="9811100002"))
    wo1 = wos.create(org_id, created_by, WorkOrderCreate(
        wo_number="WO-01", site_id=riverside.id, subcontractor_id=tiling.id,
        title="Flooring & wall tiling — towers A/B", order_date=d(18), wo_value=850000))
    wos.add_payment(org_id, wo1.id, WorkOrderPaymentCreate(amount=300000, payment_date=d(10)))
    wos.update(org_id, wo1.id, WorkOrderUpdate(progress_percent=45, status="in_progress"))
    wos.create(org_id, created_by, WorkOrderCreate(
        wo_number="WO-02", site_id=metro.id, subcontractor_id=electricals.id,
        title="Electrical conduiting & DB installation", order_date=d(8), wo_value=600000))

    # -- Equipment + usage + maintenance -----------------------------------
    eq_svc = EquipmentService(db)
    usage = UsageService(db)
    maint = MaintenanceService(db)
    jcb = eq_svc.create(org_id, created_by, EquipmentCreate(
        name="JCB 3DX Backhoe", code="EQ-JCB", category="Earthmoving", ownership="rented", rental_rate=6000))
    mixer = eq_svc.create(org_id, created_by, EquipmentCreate(
        name="Concrete Mixer", code="EQ-MIX", category="Concreting", ownership="owned", rental_rate=0))
    usage.add_usage(org_id, riverside.id, created_by, UsageCreate(equipment_id=jcb.id, usage_date=d(12), quantity=3))
    usage.add_usage(org_id, riverside.id, created_by, UsageCreate(equipment_id=jcb.id, usage_date=d(6), quantity=2))
    usage.add_usage(org_id, metro.id, created_by, UsageCreate(equipment_id=mixer.id, usage_date=d(4), quantity=5, cost=4000))
    maint.add_log(org_id, jcb.id, created_by, MaintenanceCreate(service_date=d(9), description="Hydraulic oil change", cost=8500))

    # -- Milestones ---------------------------------------------------------
    prog = ProgressService(db)
    for title, pct, weight, status, tgt in [
        ("Foundation & piling", 100, 3, "completed", d(90)),
        ("Superstructure — 10 floors", 70, 5, "in_progress", d(-30)),
        ("MEP rough-in", 30, 2, "in_progress", d(-60)),
        ("Finishing & handover", 0, 2, "pending", d(-120)),
    ]:
        prog.add_milestone(org_id, riverside.id, created_by, MilestoneCreate(
            title=title, progress_percent=pct, weight=weight, status=status, target_date=tgt))
    prog.add_milestone(org_id, metro.id, created_by, MilestoneCreate(
        title="Excavation", progress_percent=100, weight=1, status="completed", target_date=d(40)))
    prog.add_milestone(org_id, metro.id, created_by, MilestoneCreate(
        title="RCC framework", progress_percent=25, weight=3, status="in_progress", target_date=d(-45)))

    # -- Safety incidents ---------------------------------------------------
    safety = SafetyService(db)
    safety.create_incident(org_id, created_by, IncidentCreate(
        site_id=riverside.id, incident_date=d(14), incident_type="near_miss", severity="medium",
        title="Worker slipped near wet scaffold", description="No injury; area cordoned off.",
        action_taken="Anti-slip mats installed; toolbox talk conducted.", reported_by="Site Safety Officer"))
    inc2 = safety.create_incident(org_id, created_by, IncidentCreate(
        site_id=riverside.id, incident_date=d(3), incident_type="first_aid", severity="low",
        title="Minor cut while cutting rebar", action_taken="First aid administered.", reported_by="Foreman"))
    safety.update_incident(org_id, inc2.id, IncidentUpdate(status="closed"))

    # -- Daily reports ------------------------------------------------------
    rep = ReportService(db)
    rep.create_report(org_id, riverside.id, created_by, DailyReportCreate(
        report_date=d(1), manpower_count=42, weather="Clear",
        work_summary="Slab shuttering on 8th floor; steel binding in progress.",
        issues="Cement delivery delayed by 3 hours."))
    rep.create_report(org_id, riverside.id, created_by, DailyReportCreate(
        report_date=d(0), manpower_count=45, weather="Hot",
        work_summary="8th floor slab concreting completed (120 cum)."))

    return {
        "seeded": True,
        "sites": 2, "vendors": 3, "materials": 3, "workers": 4,
        "purchase_orders": 2, "client_bills": 2, "subcontractors": 2,
        "work_orders": 2, "equipment": 2, "milestones": 6, "daily_reports": 2,
        "incidents": 2,
    }
