import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.site.models.site_model import Site, SiteStatus, SiteTeamMember


class SiteRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, site: Site) -> Site:
        self.db.add(site)
        self.db.flush()
        return site

    def get_by_id(self, org_id: uuid.UUID, site_id: uuid.UUID) -> Optional[Site]:
        stmt = select(Site).where(
            Site.id == site_id, Site.org_id == org_id, Site.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, org_id: uuid.UUID, code: str) -> Optional[Site]:
        stmt = select(Site).where(
            Site.org_id == org_id, Site.code == code, Site.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        status: Optional[SiteStatus] = None,
        project_id: Optional[uuid.UUID] = None,
    ) -> Tuple[List[Site], int]:
        conditions = [Site.org_id == org_id, Site.is_deleted.is_(False)]
        if status is not None:
            conditions.append(Site.status == status)
        if project_id is not None:
            conditions.append(Site.project_id == project_id)

        base_stmt = select(Site).where(*conditions)

        count_stmt = select(func.count()).select_from(Site).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            base_stmt.order_by(Site.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def soft_delete(self, site: Site) -> None:
        site.is_deleted = True
        self.db.flush()

    def add_team_member(self, member: SiteTeamMember) -> SiteTeamMember:
        self.db.add(member)
        self.db.flush()
        return member

    def get_team_member(
        self, site_id: uuid.UUID, employee_id: uuid.UUID
    ) -> Optional[SiteTeamMember]:
        stmt = select(SiteTeamMember).where(
            SiteTeamMember.site_id == site_id, SiteTeamMember.employee_id == employee_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_team_members(self, site_id: uuid.UUID) -> List[SiteTeamMember]:
        stmt = select(SiteTeamMember).where(SiteTeamMember.site_id == site_id)
        return list(self.db.execute(stmt).scalars().all())

    def remove_team_member(self, member: SiteTeamMember) -> None:
        self.db.delete(member)
        self.db.flush()
