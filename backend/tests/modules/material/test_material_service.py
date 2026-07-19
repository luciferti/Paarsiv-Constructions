import uuid
from datetime import date

import pytest

from app.modules.material.exceptions import DuplicateMaterialCodeError, MaterialNotFoundError
from app.modules.material.models.material_model import MaterialEntryType, MaterialStatus
from app.modules.material.schemas.material_schema import (
    MaterialCreate,
    MaterialEntryCreate,
    MaterialUpdate,
)
from app.modules.material.services.material_service import MaterialEntryService, MaterialService


def make_material_payload(**overrides) -> MaterialCreate:
    data = {"name": "Cement", "code": "CEM-01", "unit": "bag"}
    data.update(overrides)
    return MaterialCreate(**data)


class TestCreateMaterial:
    def test_creates_material_with_defaults(self, db, org_id, user_id):
        service = MaterialService(db)
        material = service.create_material(org_id, user_id, make_material_payload())

        assert material.id is not None
        assert material.status == MaterialStatus.ACTIVE

    def test_rejects_duplicate_code_in_same_org(self, db, org_id, user_id):
        service = MaterialService(db)
        service.create_material(org_id, user_id, make_material_payload())

        with pytest.raises(DuplicateMaterialCodeError):
            service.create_material(org_id, user_id, make_material_payload())


class TestGetMaterial:
    def test_raises_when_not_found(self, db, org_id):
        service = MaterialService(db)
        with pytest.raises(MaterialNotFoundError):
            service.get_material(org_id, uuid.uuid4())


class TestUpdateMaterial:
    def test_updates_only_provided_fields(self, db, org_id, user_id):
        service = MaterialService(db)
        material = service.create_material(org_id, user_id, make_material_payload())

        updated = service.update_material(org_id, material.id, MaterialUpdate(category="binder"))

        assert updated.category == "binder"
        assert updated.name == "Cement"


class TestArchiveMaterial:
    def test_soft_deletes_and_hides_from_get(self, db, org_id, user_id):
        service = MaterialService(db)
        material = service.create_material(org_id, user_id, make_material_payload())

        service.archive_material(org_id, material.id)

        with pytest.raises(MaterialNotFoundError):
            service.get_material(org_id, material.id)


class TestMaterialEntriesAndStock:
    def test_stock_on_hand_reflects_received_used_and_adjusted(self, db, org_id, user_id):
        material_service = MaterialService(db)
        entry_service = MaterialEntryService(db)
        material = material_service.create_material(org_id, user_id, make_material_payload())
        site_id = uuid.uuid4()

        entry_service.add_entry(
            org_id,
            site_id,
            user_id,
            MaterialEntryCreate(
                material_id=material.id,
                entry_type=MaterialEntryType.RECEIVED,
                quantity=100,
                entry_date=date.today(),
            ),
        )
        entry_service.add_entry(
            org_id,
            site_id,
            user_id,
            MaterialEntryCreate(
                material_id=material.id,
                entry_type=MaterialEntryType.USED,
                quantity=30,
                entry_date=date.today(),
            ),
        )
        entry_service.add_entry(
            org_id,
            site_id,
            user_id,
            MaterialEntryCreate(
                material_id=material.id,
                entry_type=MaterialEntryType.ADJUSTMENT,
                quantity=5,
                entry_date=date.today(),
            ),
        )

        stock = entry_service.stock_summary(org_id, site_id)

        assert len(stock) == 1
        assert stock[0].quantity_received == 100
        assert stock[0].quantity_used == 30
        assert stock[0].quantity_adjusted == 5
        assert stock[0].quantity_on_hand == 75

    def test_rejects_entry_for_unknown_material(self, db, org_id, user_id):
        entry_service = MaterialEntryService(db)

        with pytest.raises(MaterialNotFoundError):
            entry_service.add_entry(
                org_id,
                uuid.uuid4(),
                user_id,
                MaterialEntryCreate(
                    material_id=uuid.uuid4(),
                    entry_type=MaterialEntryType.RECEIVED,
                    quantity=10,
                    entry_date=date.today(),
                ),
            )

    def test_scopes_entries_to_site(self, db, org_id, user_id):
        material_service = MaterialService(db)
        entry_service = MaterialEntryService(db)
        material = material_service.create_material(org_id, user_id, make_material_payload())
        site_a, site_b = uuid.uuid4(), uuid.uuid4()

        entry_service.add_entry(
            org_id,
            site_a,
            user_id,
            MaterialEntryCreate(
                material_id=material.id,
                entry_type=MaterialEntryType.RECEIVED,
                quantity=50,
                entry_date=date.today(),
            ),
        )

        assert entry_service.stock_summary(org_id, site_b) == []
        assert len(entry_service.list_entries(org_id, site_a)) == 1
