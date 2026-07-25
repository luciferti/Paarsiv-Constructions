"""Load realistic sample data into the caller's own organization.

Handy for demos: sign up for a fresh org, call POST /api/v1/demo/seed, and the
org fills with a coherent construction dataset across every module. Idempotent —
a second call is a no-op while the org already has sites.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.demo_seed import seed_org
from app.core.deps import CurrentUser, require_permission

router = APIRouter(prefix="/demo", tags=["demo"])

require_demo_seed = require_permission("demo:seed")


@router.post("/seed")
def seed_demo_data(
    user: CurrentUser = Depends(require_demo_seed),
    db: Session = Depends(get_db),
) -> dict:
    return seed_org(db, org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id))
