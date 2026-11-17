from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.errors import AppError
from apps.api.schemas.assets import (
    AssetDetailRead,
    AssetRead,
    AssetVersionRead,
    ExportJobRead,
    ExportRequest,
)
from apps.api.schemas.common import envelope
from apps.api.services import assets as asset_service
from apps.api.services import storage
from apps.api.services.projects import assert_project_access, get_project

router = APIRouter(tags=["assets"])


def _access(
    db: Session, principal: Principal, project_id: UUID, need: str = "projects:read"
) -> None:
    assert_project_access(
        db,
        get_project(db, project_id),
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed=need,
    )


@router.post("/projects/{project_id}/assets", status_code=201)
def upload_asset(
    project_id: UUID,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id, need="projects:write")
    data = file.file.read()
    asset = asset_service.create_from_upload(
        db,
        project_id=project_id,
        filename=file.filename or "upload.bin",
        data=data,
        mime_type=file.content_type or "application/octet-stream",
        title=title or "",
        created_by=principal.user.id,
    )
    db.commit()
    return envelope(AssetRead.model_validate(asset).model_dump(mode="json"))


@router.get("/projects/{project_id}/assets")
def list_assets(
    project_id: UUID,
    kind: str | None = None,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    assets = asset_service.list_assets(db, project_id, kind=kind)
    return envelope([AssetRead.model_validate(asset).model_dump(mode="json") for asset in assets])


@router.get("/assets/{asset_id}")
def read_asset(
    asset_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    asset = asset_service.get_asset(db, asset_id)
    _access(db, principal, asset.project_id)
    versions = [
        AssetVersionRead.model_validate(version)
        for version in asset_service.get_versions(db, asset.id)
    ]
    detail = AssetDetailRead(**AssetRead.model_validate(asset).model_dump(), versions=versions)
    return envelope(detail.model_dump(mode="json"))


@router.get("/assets/{asset_id}/download")
def download_asset(
    asset_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> FileResponse:
    asset = asset_service.get_asset(db, asset_id)
    _access(db, principal, asset.project_id)
    if not storage.exists(asset.storage_key):
        raise AppError(
            "The stored file for this asset is missing",
            code="ASSET_FILE_MISSING",
            status_code=409,
        )
    return FileResponse(
        path=storage.path_of(asset.storage_key),
        media_type=asset.mime_type,
        filename=f"{asset.id}{storage.path_of(asset.storage_key).suffix}",
    )


@router.post("/assets/{asset_id}/versions", status_code=201)
def upload_asset_version(
    asset_id: UUID,
    file: UploadFile = File(...),
    note: str | None = Form(default=None),
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    asset = asset_service.get_asset(db, asset_id)
    _access(db, principal, asset.project_id, need="projects:write")
    data = file.file.read()
    if not data:
        raise AppError("Uploaded file is empty", code="VALIDATION_ERROR", status_code=422)
    version = asset_service.add_version(db, asset, data, note=note)
    db.commit()
    return envelope(AssetVersionRead.model_validate(version).model_dump(mode="json"))


@router.post("/projects/{project_id}/exports", status_code=201)
def create_export(
    project_id: UUID,
    payload: ExportRequest,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id, need="projects:write")
    job, asset = asset_service.export_slideshow(
        db,
        project_id=project_id,
        asset_ids=payload.asset_ids,
        width=payload.width,
        height=payload.height,
        fps=payload.fps,
        seconds_per_image=payload.seconds_per_image,
        requested_by=principal.user.id,
        title=payload.title,
    )
    db.commit()
    return envelope(
        {
            "job": ExportJobRead.model_validate(job).model_dump(mode="json"),
            "asset": AssetRead.model_validate(asset).model_dump(mode="json"),
        }
    )
