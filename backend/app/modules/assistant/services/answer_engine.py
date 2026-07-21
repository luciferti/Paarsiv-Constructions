"""
Assistant answer engine.

`AssistantContext` is a read-only view over ONE org's live data — every
query it runs is filtered by org_id, so the assistant can only ever
answer from the asking organization's own sites/vendors/materials.
Both the in-app chat and the WhatsApp webhook feed questions through
`get_answer_provider()`.

`RuleBasedAnswerProvider` makes the assistant usable today with no API
key. It matches questions against intent keyword sets — including
common Hinglish phrasings (kitne, sab, chaiye, bana do, kharcha…) —
and answers from live data. It is still deterministic keyword matching,
not language understanding. TODO(integration): set OPENAI_API_KEY and
`OpenAIAnswerProvider` takes over automatically — free-form questions
in any language, grounded in the same live-data snapshot so it cannot
invent numbers or answer outside the org's data.
"""

import uuid
from abc import ABC, abstractmethod
from datetime import date, timedelta
from typing import Dict, List, Optional, Set

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.billing.services.billing_service import BillingService
from app.modules.budget.services.budget_service import BudgetService
from app.modules.equipment.models.equipment_model import Equipment, EquipmentStatus
from app.modules.expense.services.expense_service import ExpenseService
from app.modules.invoice.models.invoice_model import Invoice, InvoiceStatus
from app.modules.labour.models.labour_model import AttendanceEntry, Worker
from app.modules.material.models.material_model import Material, MaterialEntry, MaterialEntryType
from app.modules.material.services.material_service import MaterialEntryService
from app.modules.purchase.models.po_model import POStatus, PurchaseOrder
from app.modules.report.models.report_model import DailyReport
from app.modules.site.models.site_model import Site
from app.modules.subcontract.models.subcontract_model import Subcontractor, WorkOrder, WorkOrderStatus
from app.modules.vendor.models.vendor_model import Vendor

settings = get_settings()


def _fmt(value) -> str:
    """Readable amount with Indian digit grouping, no scientific notation.
    200.0 -> '200', 12.5 -> '12.5', 1000000 -> '10,00,000'."""
    try:
        num = round(float(value), 2)
    except (TypeError, ValueError):
        return str(value)
    neg = num < 0
    num = abs(num)
    whole = int(num)
    frac = round(num - whole, 2)
    s = str(whole)
    if len(s) > 3:  # Indian grouping: last 3 digits, then pairs
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    if frac > 0:
        s += f"{frac:.2f}"[1:].rstrip("0").rstrip(".")
    return ("-" if neg else "") + s


class AssistantContext:
    def __init__(self, db: Session, org_id: uuid.UUID):
        self.db = db
        self.org_id = org_id

    def sites(self) -> List[Site]:
        stmt = select(Site).where(Site.org_id == self.org_id, Site.is_deleted.is_(False))
        return list(self.db.execute(stmt).scalars().all())

    def find_site(self, question: str) -> Optional[Site]:
        q = question.lower()
        for site in self.sites():
            if site.name.lower() in q or site.code.lower() in q:
                return site
        return None

    def stock_for_site(self, site_id: uuid.UUID):
        return MaterialEntryService(self.db).stock_summary(self.org_id, site_id)

    def recent_reports(self, days: int = 7, site_id: Optional[uuid.UUID] = None) -> List[DailyReport]:
        since = date.today() - timedelta(days=days)
        conditions = [DailyReport.org_id == self.org_id, DailyReport.report_date >= since]
        if site_id is not None:
            conditions.append(DailyReport.site_id == site_id)
        stmt = select(DailyReport).where(*conditions).order_by(DailyReport.report_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def site_name_by_id(self) -> dict:
        return {site.id: site.name for site in self.sites()}

    def invoice_counts(self) -> Dict[str, int]:
        stmt = (
            select(Invoice.status, func.count())
            .where(Invoice.org_id == self.org_id)
            .group_by(Invoice.status)
        )
        return {status.value: count for status, count in self.db.execute(stmt).all()}

    def material_spend(self) -> float:
        stmt = select(func.coalesce(func.sum(MaterialEntry.quantity * MaterialEntry.unit_cost), 0)).where(
            MaterialEntry.org_id == self.org_id,
            MaterialEntry.entry_type == MaterialEntryType.RECEIVED,
            MaterialEntry.unit_cost.is_not(None),
        )
        return float(self.db.execute(stmt).scalar_one())

    def materials(self) -> List[Material]:
        stmt = select(Material).where(Material.org_id == self.org_id, Material.is_deleted.is_(False))
        return list(self.db.execute(stmt).scalars().all())

    def vendors(self) -> List[Vendor]:
        stmt = select(Vendor).where(Vendor.org_id == self.org_id, Vendor.is_deleted.is_(False))
        return list(self.db.execute(stmt).scalars().all())

    def workers(self) -> List[Worker]:
        stmt = select(Worker).where(Worker.org_id == self.org_id, Worker.is_deleted.is_(False))
        return list(self.db.execute(stmt).scalars().all())

    def labour_wage_total(self) -> float:
        stmt = select(func.coalesce(func.sum(AttendanceEntry.wage_amount), 0)).where(
            AttendanceEntry.org_id == self.org_id
        )
        return float(self.db.execute(stmt).scalar_one())

    def purchase_orders(self) -> List[PurchaseOrder]:
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.org_id == self.org_id, PurchaseOrder.is_deleted.is_(False)
        )
        return list(self.db.execute(stmt).scalars().all())

    def budget_summary_for_site(self, site_id: uuid.UUID):
        return BudgetService(self.db).summary(self.org_id, site_id)

    def petty_cash_summary(self):
        return ExpenseService(self.db).summary(self.org_id)

    def client_billing_summary(self):
        return BillingService(self.db).summary(self.org_id)

    def equipment(self) -> List[Equipment]:
        stmt = select(Equipment).where(
            Equipment.org_id == self.org_id, Equipment.is_deleted.is_(False)
        )
        return list(self.db.execute(stmt).scalars().all())

    def work_orders(self) -> List[WorkOrder]:
        stmt = (
            select(WorkOrder)
            .where(WorkOrder.org_id == self.org_id, WorkOrder.is_deleted.is_(False))
        )
        return list(self.db.execute(stmt).scalars().all())

    def subcontractor_names(self) -> dict:
        subs = self.db.execute(
            select(Subcontractor).where(
                Subcontractor.org_id == self.org_id, Subcontractor.is_deleted.is_(False)
            )
        ).scalars().all()
        return {s.id: s.name for s in subs}

    def po_open_count(self) -> int:
        open_states = (POStatus.DRAFT, POStatus.SENT, POStatus.PARTIALLY_RECEIVED)
        stmt = select(func.count()).select_from(PurchaseOrder).where(
            PurchaseOrder.org_id == self.org_id,
            PurchaseOrder.is_deleted.is_(False),
            PurchaseOrder.status.in_(open_states),
        )
        return int(self.db.execute(stmt).scalar_one())


def build_org_snapshot(context: AssistantContext) -> str:
    """Compact plain-text snapshot of the org's live data, shared by the
    OpenAI provider prompt so LLM answers stay grounded in real numbers."""
    lines: List[str] = []

    sites = context.sites()
    lines.append(f"SITES ({len(sites)}):")
    for site in sites:
        lines.append(f"- {site.code} {site.name} [{site.status.value}]")

    vendors = context.vendors()
    lines.append(f"VENDORS ({len(vendors)}):")
    for v in vendors:
        lines.append(f"- {v.code} {v.name} [{v.status.value}]")

    materials = context.materials()
    lines.append(f"MATERIAL CATALOG ({len(materials)}):")
    for m in materials:
        lines.append(f"- {m.code} {m.name} ({m.unit})")

    names = context.site_name_by_id()
    reports = context.recent_reports(days=7)
    lines.append(f"DAILY REPORTS, LAST 7 DAYS ({len(reports)}):")
    for r in reports[:10]:
        issue = f" ISSUES: {r.issues}" if r.issues else ""
        lines.append(f"- {r.report_date} {names.get(r.site_id, '?')}: {r.work_summary}{issue}")

    lines.append("MATERIAL STOCK BY SITE:")
    for site in sites:
        for item in context.stock_for_site(site.id):
            lines.append(
                f"- {site.name}: {item.material_name} {_fmt(item.quantity_on_hand)} {item.unit} on hand"
            )

    workers = context.workers()
    lines.append(f"LABOUR ({len(workers)} workers):")
    for w in workers[:20]:
        trade = f" {w.trade}" if w.trade else ""
        lines.append(f"- {w.code} {w.name}{trade} @ {_fmt(float(w.default_wage_rate))}/day")
    lines.append(f"LABOUR WAGES RECORDED: {_fmt(context.labour_wage_total())}")

    pos = context.purchase_orders()
    lines.append(f"PURCHASE ORDERS ({len(pos)} total, {context.po_open_count()} open):")
    for p in pos[:15]:
        total = sum(float(ln.quantity) * float(ln.unit_price) for ln in p.lines)
        lines.append(f"- {p.po_number} [{p.status.value}] {_fmt(total)}")

    counts = context.invoice_counts()
    lines.append(f"INVOICES: {sum(counts.values())} total, by status: {counts or 'none'}")
    lines.append(f"MATERIAL SPEND (received entries with a unit cost): {_fmt(context.material_spend())}")
    return "\n".join(lines)


class AnswerProvider(ABC):
    model_name: str

    @abstractmethod
    def answer(self, question: str, context: AssistantContext) -> str: ...


HELP_TEXT = (
    "I answer only from your organization's live data — sites, materials, vendors, "
    "daily reports and invoices. Try:\n"
    "• \"What's the stock at Riverside Tower?\" / \"stock kitna hai\"\n"
    "• \"Any issues this week?\"\n"
    "• \"Sab sites vendors materials ki summary chaiye\"\n"
    "• \"Invoices kitne hain?\" / \"material ka kharcha kitna hua\"\n"
    "I can't create or edit records — I'll point you to the right page instead."
)

# Intent keyword sets. Hinglish included so common phrasings work without an LLM.
_W = {
    "summary": {"summary", "overview", "digest", "report card", "sab kuch", "everything", "पूरा"},
    "all": {"sab", "sabhi", "saare", "sare", "all", "total", "pura", "poora"},
    "count": {"kitne", "kitna", "kitni", "how many", "count", "number of"},
    "stock": {"stock", "inventory", "on hand", "saman", "samaan", "maal", "bacha"},
    "material": {"material", "materials", "meterial", "meterials", "cement", "steel"},
    "price": {"price", "cost", "spend", "kharcha", "kharch", "kimat", "keemat", "daam", "rate", "amount", "paisa", "paise"},
    "issue": {"issue", "issues", "blocker", "problem", "dikkat", "delay", "atka", "rukavat"},
    "report": {"report", "reports", "daily report"},
    "invoice": {"invoice", "invoices", "bill", "bills", "payment"},
    "vendor": {"vendor", "vendors", "vender", "venders", "venoder", "venoders", "supplier", "suppliers"},
    "site": {"site", "sites", "project", "projects"},
    "labour": {"labour", "labor", "labourer", "labourers", "worker", "workers", "mazdoor", "mazdur", "majdoor", "attendance", "haziri", "hazri", "muster", "wage", "wages", "dihaadi", "dihadi", "majduri", "mazduri"},
    "po": {"purchase order", "purchase orders", "purchase", " po ", " pos ", "p.o", "khareed", "kharid"},
    "budget": {"budget", "budgeted", "boq", "bajat", "over budget", "under budget", "cost overrun", "variance"},
    "cash": {"petty cash", "pettycash", "cash", "expense", "expenses", "cash balance", "float", "imprest", "topup", "top up"},
    "billing": {"ra bill", "ra bills", "client bill", "client bills", "billing", "billed", "client payment", "receivable", "outstanding from client", "running account"},
    "subcontract": {"subcontractor", "subcontractors", "sub-contractor", "subcon", "subbie", "work order", "work orders", "workorder", "petty contractor", "thekedar", "theka"},
    "equipment": {"equipment", "machine", "machines", "machinery", "plant", "excavator", "jcb", "crane", "mixer", "vehicle", "vehicles", "gaadi", "machinery register"},
    "create": {"bana", "banao", "banado", "create", "add kar", "upload kar", "kar do", "kar sakte", "skte ho", "sakte ho", "naya", "nayi", "new "},
}


def _has(q: str, key: str) -> bool:
    return any(w in q for w in _W[key])


CREATE_GUIDES = [
    ("invoice", "invoice", "I can't create records myself — I only read your data. To add an invoice: open the Invoices page → \"+ Upload Invoice\", pick the vendor and file, and I'll see it here once it's saved."),
    ("site", "site", "I can't create records myself — I only read your data. To add a site: Sites page → \"+ New Site\"."),
    ("vendor", "vendor", "I can't create records myself — I only read your data. To add a vendor: Vendors page → \"+ New Vendor\"."),
    ("material", "material", "I can't create records myself — I only read your data. To add a material: Materials page → \"+ New Material\". To log stock in/out: open a site → Materials tab → Log Entry."),
    ("report", "report", "I can't create records myself — I only read your data. To log a daily report: open a site → Reports tab → Log Report."),
    ("labour", "labour", "I can't create records myself — I only read your data. To add a worker: Workers page → \"+ New Worker\". To mark attendance: open a site → Labour tab → Mark Attendance."),
    ("po", "po", "I can't create records myself — I only read your data. To raise a purchase order: Purchase Orders page → \"+ New PO\", pick the vendor and add line items."),
    ("cash", "cash", "I can't create records myself — I only read your data. To log petty cash: Petty Cash page → add a top-up or an expense with its category."),
    ("billing", "billing", "I can't create records myself — I only read your data. To raise a client RA bill: Client Bills page → \"+ New Bill\", pick the site and enter the gross value and deductions."),
    ("subcontract", "subcontract", "I can't create records myself — I only read your data. To add a subcontractor: Subcontractors page → \"+ New\". To raise a work order: Work Orders page → \"+ New WO\"."),
    ("equipment", "equipment", "I can't create records myself — I only read your data. To add machinery: Equipment page → \"+ New Equipment\". To log usage: open a site → Equipment tab → Log Usage."),
]


class RuleBasedAnswerProvider(AnswerProvider):
    model_name = "rule-based-v1"

    def answer(self, question: str, context: AssistantContext) -> str:
        q = " " + question.lower().strip() + " "

        # "Can you create/add X?" — guide instead of misreading it as a data query.
        if _has(q, "create"):
            for _, domain_key, guide in CREATE_GUIDES:
                if _has(q, domain_key):
                    return guide

        domains: Set[str] = {
            key for key in ("site", "vendor", "material", "invoice", "report", "stock", "issue", "labour", "po", "budget")
            if _has(q, key)
        }

        # "sab sites vendors materials ki summary chaiye" → one combined answer.
        if _has(q, "summary") or (_has(q, "all") and len(domains) >= 2) or len(domains) >= 3:
            return self._org_summary(context)

        if _has(q, "equipment"):
            return self._answer_equipment(context)
        if _has(q, "subcontract"):
            return self._answer_subcontract(context)
        if _has(q, "billing"):
            return self._answer_billing(context)
        if _has(q, "cash"):
            return self._answer_petty_cash(context)
        if _has(q, "budget"):
            return self._answer_budget(context)
        if _has(q, "po"):
            return self._answer_purchase_orders(context)
        if _has(q, "labour"):
            return self._answer_labour(context)
        if _has(q, "issue"):
            return self._answer_issues(context)
        if _has(q, "stock") or (_has(q, "material") and not _has(q, "price")):
            return self._answer_stock(q, context)
        if _has(q, "price"):
            return self._answer_spend(context)
        if _has(q, "invoice"):
            return self._answer_invoices(context)
        if _has(q, "report"):
            return self._answer_reports(q, context)
        if _has(q, "vendor"):
            return self._answer_vendors(context)
        if _has(q, "site"):
            return self._answer_sites(context)
        return HELP_TEXT

    def _org_summary(self, context: AssistantContext) -> str:
        parts: List[str] = ["Here's your full summary (live data):", ""]

        sites = context.sites()
        parts.append(f"SITES ({len(sites)}):")
        if sites:
            parts.extend(f"• {s.code} {s.name} [{s.status.value.replace('_', ' ')}]" for s in sites)
        else:
            parts.append("• none yet")

        vendors = context.vendors()
        parts.append("")
        parts.append(f"VENDORS ({len(vendors)}):")
        if vendors:
            parts.extend(f"• {v.code} {v.name} [{v.status.value}]" for v in vendors[:10])
        else:
            parts.append("• none yet")

        materials = context.materials()
        parts.append("")
        parts.append(f"MATERIALS ({len(materials)}):")
        if materials:
            parts.extend(f"• {m.code} {m.name} ({m.unit})" for m in materials[:10])
        else:
            parts.append("• none yet")

        stock_lines = []
        for site in sites:
            for item in context.stock_for_site(site.id):
                stock_lines.append(
                    f"• {site.name}: {item.material_name} — {_fmt(item.quantity_on_hand)} {item.unit} on hand"
                )
        if stock_lines:
            parts.append("")
            parts.append("STOCK:")
            parts.extend(stock_lines)

        spend = context.material_spend()
        if spend > 0:
            parts.append("")
            parts.append(f"MATERIAL SPEND (from logged entries): {_fmt(spend)}")

        workers = context.workers()
        if workers:
            wages = context.labour_wage_total()
            parts.append("")
            parts.append(
                f"LABOUR: {len(workers)} worker(s)"
                + (f", wages recorded ₹{_fmt(wages)}" if wages > 0 else "")
            )

        pos = context.purchase_orders()
        if pos:
            parts.append("")
            parts.append(f"PURCHASE ORDERS: {len(pos)} total, {context.po_open_count()} open")

        counts = context.invoice_counts()
        parts.append("")
        parts.append(
            f"INVOICES: {sum(counts.values())} total"
            + (f" ({counts.get('pending_review', 0)} pending review)" if counts else "")
        )

        flagged = [r for r in context.recent_reports(days=7) if r.issues]
        if flagged:
            names = context.site_name_by_id()
            parts.append("")
            parts.append(f"ISSUES, LAST 7 DAYS ({len(flagged)}):")
            parts.extend(f"• {r.report_date} {names.get(r.site_id, '?')}: {r.issues}" for r in flagged[:5])

        return "\n".join(parts)

    def _answer_sites(self, context: AssistantContext) -> str:
        sites = context.sites()
        if not sites:
            return "No sites yet. Create one from the Sites page."
        listing = "\n".join(f"• {s.code} {s.name} [{s.status.value.replace('_', ' ')}]" for s in sites)
        return f"You have {len(sites)} site(s):\n{listing}"

    def _answer_vendors(self, context: AssistantContext) -> str:
        vendors = context.vendors()
        if not vendors:
            return "No vendors yet. Add one from the Vendors page."
        listing = "\n".join(f"• {v.code} {v.name} [{v.status.value}]" for v in vendors[:10])
        return f"You have {len(vendors)} vendor(s):\n{listing}"

    def _answer_labour(self, context: AssistantContext) -> str:
        workers = context.workers()
        if not workers:
            return "No workers on the roster yet. Add one from the Workers page, then mark attendance on a site's Labour tab."
        active = [w for w in workers if w.status.value == "active"]
        listing = "\n".join(
            f"• {w.code} {w.name}"
            + (f" — {w.trade}" if w.trade else "")
            + f" (₹{_fmt(float(w.default_wage_rate))}/day)"
            for w in workers[:15]
        )
        wages = context.labour_wage_total()
        tail = f"\n\nTotal wages recorded so far: ₹{_fmt(wages)}" if wages > 0 else ""
        return f"You have {len(workers)} worker(s), {len(active)} active:\n{listing}{tail}"

    def _answer_equipment(self, context: AssistantContext) -> str:
        eq = context.equipment()
        if not eq:
            return "No equipment on the register yet. Add machinery from the Equipment page."
        by_status: Dict[str, int] = {}
        for e in eq:
            by_status[e.status.value] = by_status.get(e.status.value, 0) + 1
        status_bits = ", ".join(f"{n} {s.replace('_', ' ')}" for s, n in by_status.items())
        listing = "\n".join(
            f"• {e.code} {e.name}"
            + (f" — {e.category}" if e.category else "")
            + f" [{e.ownership.value}, {e.status.value.replace('_', ' ')}]"
            for e in eq[:15]
        )
        return f"You have {len(eq)} equipment item(s) ({status_bits}):\n{listing}"

    def _answer_subcontract(self, context: AssistantContext) -> str:
        wos = context.work_orders()
        if not wos:
            return "No work orders yet. Add a subcontractor, then raise a work order from the Work Orders page."
        names = context.subcontractor_names()

        def paid(wo) -> float:
            return sum(float(p.amount) for p in wo.payments)

        total_value = sum(float(w.wo_value) for w in wos)
        total_paid = sum(paid(w) for w in wos)
        open_n = sum(1 for w in wos if w.status.value in ("open", "in_progress"))
        listing = "\n".join(
            f"• {w.wo_number} — {names.get(w.subcontractor_id, 'subcontractor')} "
            f"[{w.status.value.replace('_', ' ')}, {_fmt(float(w.progress_percent))}%] "
            f"₹{_fmt(float(w.wo_value))} (paid ₹{_fmt(paid(w))})"
            for w in wos[:12]
        )
        return (
            f"You have {len(wos)} work order(s), {open_n} active:\n{listing}"
            f"\n\nTotal WO value ₹{_fmt(total_value)}, paid ₹{_fmt(total_paid)}, "
            f"balance ₹{_fmt(total_value - total_paid)}"
        )

    def _answer_billing(self, context: AssistantContext) -> str:
        s = context.client_billing_summary()
        if s.bill_count == 0:
            return "No client RA bills yet. Raise one from the Client Bills page → + New Bill."
        return (
            f"Client billing across {s.bill_count} RA bill(s):\n"
            f"• Gross billed: ₹{_fmt(s.total_gross)}\n"
            f"• Net (after retention/TDS): ₹{_fmt(s.total_net)}\n"
            f"• Received (paid): ₹{_fmt(s.total_paid)}\n"
            f"• Outstanding from client: ₹{_fmt(s.total_outstanding)}"
        )

    def _answer_petty_cash(self, context: AssistantContext) -> str:
        s = context.petty_cash_summary()
        if s.total_topup == 0 and s.total_expense == 0:
            return "No petty-cash activity yet. Log top-ups and expenses from the Petty Cash page."
        parts = [
            f"Petty cash balance: ₹{_fmt(s.balance)}",
            f"(topped up ₹{_fmt(s.total_topup)}, spent ₹{_fmt(s.total_expense)})",
        ]
        if s.expense_by_category:
            parts.append("")
            parts.append("Top spend categories:")
            parts.extend(f"• {row.category}: ₹{_fmt(row.amount)}" for row in s.expense_by_category[:5])
        return "\n".join(parts)

    def _answer_budget(self, context: AssistantContext) -> str:
        sites = context.sites()
        if not sites:
            return "No sites yet, so no budgets. Create a site, then add budget lines on its Budget tab."
        rows: List[str] = []
        any_budget = False
        for site in sites:
            s = context.budget_summary_for_site(site.id)
            if s.total_budgeted == 0 and s.actual_total == 0:
                continue
            any_budget = True
            flag = " ⚠️ over budget" if s.variance < 0 else ""
            rows.append(
                f"• {site.name}: budget ₹{_fmt(s.total_budgeted)}, "
                f"spent ₹{_fmt(s.actual_total)} ({_fmt(s.percent_used)}%){flag}"
            )
        if not any_budget:
            return "No budgets set yet. Open a site → Budget tab → add budget lines to track budget vs actual."
        return "Budget vs actual by site (actuals = materials + labour + approved invoices):\n" + "\n".join(rows)

    def _answer_purchase_orders(self, context: AssistantContext) -> str:
        pos = context.purchase_orders()
        if not pos:
            return "No purchase orders yet. Raise one from the Purchase Orders page → + New PO."
        vendor_name = {v.id: v.name for v in context.vendors()}

        def po_total(po) -> float:
            return sum(float(line.quantity) * float(line.unit_price) for line in po.lines)

        grand = sum(po_total(p) for p in pos)
        open_n = context.po_open_count()
        listing = "\n".join(
            f"• {p.po_number} — {vendor_name.get(p.vendor_id, 'vendor')} "
            f"[{p.status.value.replace('_', ' ')}] ₹{_fmt(po_total(p))}"
            for p in pos[:12]
        )
        return (
            f"You have {len(pos)} purchase order(s), {open_n} still open:\n{listing}"
            f"\n\nTotal ordered value: ₹{_fmt(grand)}"
        )

    def _answer_invoices(self, context: AssistantContext) -> str:
        counts = context.invoice_counts()
        total = sum(counts.values())
        if total == 0:
            return "No invoices uploaded yet. Add one from the Invoices page → Upload Invoice."
        parts = [f"You have {total} invoice(s):"]
        label = {"pending_review": "pending review", "approved": "approved", "rejected": "rejected"}
        for status, count in counts.items():
            parts.append(f"• {count} {label.get(status, status)}")
        return "\n".join(parts)

    def _answer_spend(self, context: AssistantContext) -> str:
        spend = context.material_spend()
        counts = context.invoice_counts()
        parts: List[str] = []
        if spend > 0:
            parts.append(f"Material spend from logged entries (qty × unit cost): {_fmt(spend)}")
        else:
            parts.append(
                "No material costs logged yet — add a unit cost when logging material entries "
                "and I'll total it up here."
            )
        if counts:
            parts.append(f"Invoices: {sum(counts.values())} total ({counts.get('pending_review', 0)} pending review).")
        return "\n".join(parts)

    def _answer_stock(self, q: str, context: AssistantContext) -> str:
        site = context.find_site(q)
        targets = [site] if site else context.sites()
        lines: List[str] = []
        for target in targets:
            for item in context.stock_for_site(target.id):
                lines.append(
                    f"• {target.name}: {item.material_name} — {_fmt(item.quantity_on_hand)} {item.unit} on hand "
                    f"(received {_fmt(item.quantity_received)}, used {_fmt(item.quantity_used)})"
                )
        if not lines:
            where = f" at {site.name}" if site else ""
            return f"No material entries logged{where} yet. Log entries from a site's Materials tab."
        header = f"Stock at {site.name}:" if site else "Stock across all sites:"
        return header + "\n" + "\n".join(lines)

    def _answer_issues(self, context: AssistantContext) -> str:
        names = context.site_name_by_id()
        flagged = [r for r in context.recent_reports(days=7) if r.issues]
        if not flagged:
            return "No issues or blockers reported in the last 7 days."
        lines = [f"• {r.report_date} {names.get(r.site_id, '?')}: {r.issues}" for r in flagged[:10]]
        return f"{len(flagged)} issue(s) reported in the last 7 days:\n" + "\n".join(lines)

    def _answer_reports(self, q: str, context: AssistantContext) -> str:
        site = context.find_site(q)
        names = context.site_name_by_id()
        if "today" in q or "aaj" in q:
            todays = context.recent_reports(days=0)
            reported_ids = {r.site_id for r in todays}
            reported = [names[i] for i in reported_ids if i in names]
            missing = [s.name for s in context.sites() if s.id not in reported_ids]
            parts = [
                f"Reported today: {', '.join(reported)}" if reported else "No reports submitted today."
            ]
            if missing:
                parts.append(f"Still missing: {', '.join(missing)}")
            return "\n".join(parts)

        reports = context.recent_reports(days=7, site_id=site.id if site else None)
        if not reports:
            where = f" for {site.name}" if site else ""
            return f"No daily reports{where} in the last 7 days."
        lines = [f"• {r.report_date} {names.get(r.site_id, '?')}: {r.work_summary}" for r in reports[:7]]
        return "Recent daily reports:\n" + "\n".join(lines)


class OpenAIAnswerProvider(AnswerProvider):
    model_name = "gpt-4o-mini"

    def answer(self, question: str, context: AssistantContext) -> str:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        prompt = (
            "You are the site assistant for a construction management app. Answer the "
            "user's question using ONLY the data snapshot below — never invent data and "
            "never answer questions unrelated to this organization's construction data. "
            "Reply in the same language the user asked in (English, Hindi or Hinglish). "
            "Be concise and concrete; if the snapshot doesn't contain the answer, say so.\n\n"
            f"=== DATA SNAPSHOT ===\n{build_org_snapshot(context)}\n\n"
            f"=== QUESTION ===\n{question}"
        )
        response = client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""


def get_answer_provider() -> AnswerProvider:
    if settings.openai_api_key:
        return OpenAIAnswerProvider()
    return RuleBasedAnswerProvider()
