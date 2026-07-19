import uuid

import pytest

from app.modules.vendor.exceptions import DuplicateVendorCodeError, VendorNotFoundError
from app.modules.vendor.models.vendor_model import VendorStatus
from app.modules.vendor.schemas.vendor_schema import VendorCreate, VendorUpdate
from app.modules.vendor.services.vendor_service import VendorService


def make_vendor_payload(**overrides) -> VendorCreate:
    data = {"name": "Ace Steel Supply", "code": "ACE-01"}
    data.update(overrides)
    return VendorCreate(**data)


class TestCreateVendor:
    def test_creates_vendor_with_defaults(self, db, org_id, user_id):
        service = VendorService(db)
        vendor = service.create_vendor(org_id, user_id, make_vendor_payload())

        assert vendor.id is not None
        assert vendor.status == VendorStatus.ACTIVE
        assert vendor.is_deleted is False

    def test_rejects_duplicate_code_in_same_org(self, db, org_id, user_id):
        service = VendorService(db)
        service.create_vendor(org_id, user_id, make_vendor_payload())

        with pytest.raises(DuplicateVendorCodeError):
            service.create_vendor(org_id, user_id, make_vendor_payload())


class TestGetVendor:
    def test_raises_when_not_found(self, db, org_id):
        service = VendorService(db)
        with pytest.raises(VendorNotFoundError):
            service.get_vendor(org_id, uuid.uuid4())


class TestListVendors:
    def test_filters_by_status(self, db, org_id, user_id):
        service = VendorService(db)
        service.create_vendor(org_id, user_id, make_vendor_payload(code="V1"))
        service.create_vendor(
            org_id, user_id, make_vendor_payload(code="V2", status=VendorStatus.INACTIVE)
        )

        result = service.list_vendors(org_id, status=VendorStatus.INACTIVE)

        assert result.total == 1
        assert result.items[0].code == "V2"


class TestUpdateVendor:
    def test_updates_only_provided_fields(self, db, org_id, user_id):
        service = VendorService(db)
        vendor = service.create_vendor(org_id, user_id, make_vendor_payload())

        updated = service.update_vendor(org_id, vendor.id, VendorUpdate(category="steel"))

        assert updated.category == "steel"
        assert updated.name == "Ace Steel Supply"


class TestArchiveVendor:
    def test_soft_deletes_and_hides_from_get(self, db, org_id, user_id):
        service = VendorService(db)
        vendor = service.create_vendor(org_id, user_id, make_vendor_payload())

        service.archive_vendor(org_id, vendor.id)

        with pytest.raises(VendorNotFoundError):
            service.get_vendor(org_id, vendor.id)
