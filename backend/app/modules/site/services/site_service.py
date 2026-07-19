import uuid
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.site.exceptions import (
    DuplicateSiteCodeError,
    DuplicateSiteTeamMemberError,
    SiteNotFoundError,
    SiteTeamMemberNotFoundError,
)
from app.modules.site.models.site_model import Site, SiteStatus, SiteTeamMember
from app.modules.site.repositories.site_repository import SiteRepository
from app.modules.site.schemas.site_schema import (
    PaginatedSites,
    SiteCreate,
    SiteTeamMemberCreate,
    SiteUpdate,
)


class SiteService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SiteRepository(db)

    def create_site(self, org_id: uuid.UUID, created_by: uuid.UUID, payload: SiteCreate) -> Site:
        if self.repo.get_by_code(org_id, payload.code) is not None:
            raise DuplicateSiteCodeError(payload.code)

        site = Site(
            org_id=org_id,
            created_by=created_by,
            **payload.model_dump(),
        )
        site = self.repo.create(site)
        self.db.commit()
        self.db.refresh(site)
        return site

    def get_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> Site:
        site = self.repo.get_by_id(org_id, site_id)
        if site is None:
            raise SiteNotFoundError(site_id)
        return site

    def list_sites(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[SiteStatus] = None,
        project_id: Optional[uuid.UUID] = None,
    ) -> PaginatedSites:
        items, total = self.repo.list(
            org_id, page=page, page_size=page_size, status=status, project_id=project_id
        )
        return PaginatedSites(items=items, total=total, page=page, page_size=page_size)

    def update_site(self, org_id: uuid.UUID, site_id: uuid.UUID, payload: SiteUpdate) -> Site:
        site = self.get_site(org_id, site_id)
        updates = payload.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(site, field, value)
        self.db.commit()
        self.db.refresh(site)
        return site

    def archive_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> None:
        site = self.get_site(org_id, site_id)
        site.status = SiteStatus.ARCHIVED
        self.repo.soft_delete(site)
        self.db.commit()

    def list_team_members(self, org_id: uuid.UUID, site_id: uuid.UUID):
        self.get_site(org_id, site_id)  # ensures site exists and belongs to org
        return self.repo.list_team_members(site_id)

    def add_team_member(
        self, org_id: uuid.UUID, site_id: uuid.UUID, payload: SiteTeamMemberCreate
    ) -> SiteTeamMember:
        self.get_site(org_id, site_id)
        if self.repo.get_team_member(site_id, payload.employee_id) is not None:
            raise DuplicateSiteTeamMemberError(payload.employee_id)

        member = SiteTeamMember(
            site_id=site_id,
            employee_id=payload.employee_id,
            role_on_site=payload.role_on_site,
            assigned_at=date.today(),
        )
        member = self.repo.add_team_member(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def remove_team_member(
        self, org_id: uuid.UUID, site_id: uuid.UUID, employee_id: uuid.UUID
    ) -> None:
        self.get_site(org_id, site_id)
        member = self.repo.get_team_member(site_id, employee_id)
        if member is None:
            raise SiteTeamMemberNotFoundError(site_id, employee_id)
        self.repo.remove_team_member(member)
        self.db.commit()
