import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.demo_seed import seed_org
from app.core.deps import CurrentUser, get_current_user
from app.main import app


class TestSeedFunction:
    def test_seed_populates_all_modules(self, db, org_id, user_id):
        result = seed_org(db, org_id, user_id)
        assert result["seeded"] is True
        assert result["sites"] == 2

        # Spot-check across modules that the data is really queryable + computed.
        from app.modules.billing.services.billing_service import BillingService
        from app.modules.budget.services.budget_service import BudgetService
        from app.modules.labour.services.labour_service import WorkerService
        from app.modules.purchase.services.po_service import PurchaseOrderService
        from app.modules.site.services.site_service import SiteService
        from app.modules.subcontract.services.subcontract_service import WorkOrderService

        sites = SiteService(db).list_sites(org_id)
        assert sites.total == 2

        workers = WorkerService(db).list_workers(org_id)
        assert workers.total == 4

        pos = PurchaseOrderService(db).list_pos(org_id)
        assert pos.total == 2
        assert any(p.total_amount > 0 for p in pos.items)

        # Client billing: one paid, one outstanding.
        billing = BillingService(db).summary(org_id)
        assert billing.total_paid > 0
        assert billing.total_outstanding > 0

        # Budget actuals rolled up from material + labour + equipment on Riverside.
        riverside = next(s for s in sites.items if s.code == "RVT-01")
        budget = BudgetService(db).summary(org_id, riverside.id)
        assert budget.total_budgeted > 0
        assert budget.actual_material > 0
        assert budget.actual_labour > 0
        assert budget.actual_equipment > 0

        # Work order balance from a logged payment.
        wos = WorkOrderService(db).list(org_id)
        assert wos.total == 2
        assert any(w.total_paid > 0 and w.balance > 0 for w in wos.items)

    def test_seed_is_idempotent(self, db, org_id, user_id):
        assert seed_org(db, org_id, user_id)["seeded"] is True
        second = seed_org(db, org_id, user_id)
        assert second["seeded"] is False


class TestSeedEndpoint:
    def test_seed_endpoint(self, db, org_id, user_id):
        def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=frozenset({"demo:seed"})
        )
        client = TestClient(app)
        r = client.post("/api/v1/demo/seed")
        assert r.status_code == 200
        assert r.json()["seeded"] is True
        # Second call is a no-op.
        assert client.post("/api/v1/demo/seed").json()["seeded"] is False
        app.dependency_overrides.clear()
