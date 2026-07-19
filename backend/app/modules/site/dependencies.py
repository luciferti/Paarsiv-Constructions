from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.site.services.site_service import SiteService

require_site_view = require_permission("site:view")
require_site_create = require_permission("site:create")
require_site_edit = require_permission("site:edit")
require_site_archive = require_permission("site:archive")
require_site_team_manage = require_permission("site:team:manage")


def get_site_service(db: Session = Depends(get_db)) -> SiteService:
    return SiteService(db)
