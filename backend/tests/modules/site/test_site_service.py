import uuid

import pytest

from app.modules.site.exceptions import (
    DuplicateSiteCodeError,
    DuplicateSiteTeamMemberError,
    SiteNotFoundError,
    SiteTeamMemberNotFoundError,
)
from app.modules.site.models.site_model import SiteStatus
from app.modules.site.schemas.site_schema import (
    SiteCreate,
    SiteTeamMemberCreate,
    SiteUpdate,
)
from app.modules.site.services.site_service import SiteService


def make_site_payload(**overrides) -> SiteCreate:
    data = {"name": "Downtown Tower", "code": "DTX-01"}
    data.update(overrides)
    return SiteCreate(**data)


class TestCreateSite:
    def test_creates_site_with_defaults(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())

        assert site.id is not None
        assert site.org_id == org_id
        assert site.status == SiteStatus.PLANNING
        assert site.is_deleted is False

    def test_rejects_duplicate_code_in_same_org(self, db, org_id, user_id):
        service = SiteService(db)
        service.create_site(org_id, user_id, make_site_payload())

        with pytest.raises(DuplicateSiteCodeError):
            service.create_site(org_id, user_id, make_site_payload())

    def test_allows_same_code_in_different_orgs(self, db, user_id):
        service = SiteService(db)
        service.create_site(uuid.uuid4(), user_id, make_site_payload())
        # different org, same code -> should not raise
        service.create_site(uuid.uuid4(), user_id, make_site_payload())


class TestGetSite:
    def test_raises_when_not_found(self, db, org_id):
        service = SiteService(db)
        with pytest.raises(SiteNotFoundError):
            service.get_site(org_id, uuid.uuid4())

    def test_raises_when_site_belongs_to_other_org(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())

        with pytest.raises(SiteNotFoundError):
            service.get_site(uuid.uuid4(), site.id)


class TestListSites:
    def test_paginates_and_filters_by_status(self, db, org_id, user_id):
        service = SiteService(db)
        service.create_site(org_id, user_id, make_site_payload(code="A1"))
        service.create_site(org_id, user_id, make_site_payload(code="A2", status=SiteStatus.ACTIVE))

        result = service.list_sites(org_id, page=1, page_size=10, status=SiteStatus.ACTIVE)

        assert result.total == 1
        assert result.items[0].code == "A2"

    def test_excludes_other_orgs(self, db, org_id, user_id):
        service = SiteService(db)
        service.create_site(org_id, user_id, make_site_payload())
        service.create_site(uuid.uuid4(), user_id, make_site_payload())

        result = service.list_sites(org_id)

        assert result.total == 1


class TestUpdateSite:
    def test_updates_only_provided_fields(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())

        updated = service.update_site(
            org_id, site.id, SiteUpdate(status=SiteStatus.ACTIVE)
        )

        assert updated.status == SiteStatus.ACTIVE
        assert updated.name == "Downtown Tower"


class TestArchiveSite:
    def test_soft_deletes_and_hides_from_get(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())

        service.archive_site(org_id, site.id)

        with pytest.raises(SiteNotFoundError):
            service.get_site(org_id, site.id)


class TestTeamMembers:
    def test_add_and_list_team_member(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())
        employee_id = uuid.uuid4()

        service.add_team_member(
            org_id, site.id, SiteTeamMemberCreate(employee_id=employee_id, role_on_site="Foreman")
        )
        members = service.list_team_members(org_id, site.id)

        assert len(members) == 1
        assert members[0].employee_id == employee_id
        assert members[0].role_on_site == "Foreman"

    def test_rejects_duplicate_team_member(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())
        employee_id = uuid.uuid4()
        payload = SiteTeamMemberCreate(employee_id=employee_id, role_on_site="Foreman")
        service.add_team_member(org_id, site.id, payload)

        with pytest.raises(DuplicateSiteTeamMemberError):
            service.add_team_member(org_id, site.id, payload)

    def test_remove_team_member(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())
        employee_id = uuid.uuid4()
        service.add_team_member(
            org_id, site.id, SiteTeamMemberCreate(employee_id=employee_id, role_on_site="Foreman")
        )

        service.remove_team_member(org_id, site.id, employee_id)

        assert service.list_team_members(org_id, site.id) == []

    def test_raises_when_removing_unassigned_member(self, db, org_id, user_id):
        service = SiteService(db)
        site = service.create_site(org_id, user_id, make_site_payload())

        with pytest.raises(SiteTeamMemberNotFoundError):
            service.remove_team_member(org_id, site.id, uuid.uuid4())
