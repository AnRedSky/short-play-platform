"""Asset and export HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.domains.assets import service as assets_service
from app.domains.assets.schemas import (
    AssetDetailRead,
    AssetRead,
    AssetVersionRead,
    ExportJobRead,
    ExportRequest,
)
from app.domains.projects import service as projects_service
from app.infrastructure import storage
from app.public.constants import ErrorCode
from app.public.exceptions import AppError
from app.public.schemas import envelope

router = APIRouter(tags=["assets"])


def _project(
    db: Session,
    principal: Principal,
    project_id: UUID,
    *,
    need: str = "project.read",
):
    return projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed=need,
    )


@router.post("/projects/{project_id}/assets", status_code=201)
def upload_asset(
    project_id: UUID,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _project(db, principal, project_id, need="creation.write")
    asset = assets_service.create_from_upload(
        db,
        project_id=project_id,
        filename=file.filename or "upload.bin",
        data=file.file.read(),
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
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _project(db, principal, project_id)
    assets = assets_service.list_assets(db, project_id, kind=kind)
    return envelope([AssetRead.model_validate(asset).model_dump(mode="json") for asset in assets])


@router.get("/assets/{asset_id}")
def read_asset(
    asset_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id)
    versions = [
        AssetVersionRead.model_validate(version)
        for version in assets_service.get_versions(db, asset.id)
    ]
    detail = AssetDetailRead(**AssetRead.model_validate(asset).model_dump(), versions=versions)
    return envelope(detail.model_dump(mode="json"))


@router.get("/assets/{asset_id}/download")
def download_asset(
    asset_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> FileResponse:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id)
    if not storage.exists(asset.storage_key):
        raise AppError(
            "The stored file for this asset is missing",
            code=ErrorCode.ASSET_FILE_MISSING,
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
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id, need="creation.write")
    version = assets_service.add_version(db, asset, file.file.read(), note=note)
    db.commit()
    return envelope(AssetVersionRead.model_validate(version).model_dump(mode="json"))


@router.post("/projects/{project_id}/exports", status_code=201)
def create_export(
    project_id: UUID,
    payload: ExportRequest,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _project(db, principal, project_id, need="creation.write")
    job, asset = assets_service.export_slideshow(
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
