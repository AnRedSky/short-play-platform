"""Asset and export HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.domains.assets import service as assets_service
from app.domains.assets.schemas import (
    AssetDetailRead,
    AssetQCCheckRead,
    AssetQCRequest,
    AssetRead,
    AssetReferenceCreate,
    AssetReferenceRead,
    AssetVersionRead,
    AuthorizationUpdate,
    DirectUploadComplete,
    DirectUploadCreate,
    DirectUploadRead,
    ExportJobRead,
    ExportRequest,
)
from app.domains.projects import service as projects_service
from app.infrastructure import storage
from app.public.constants import ErrorCode
from app.public.exceptions import AppError, not_found
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
    detail = AssetDetailRead(
        **AssetRead.model_validate(asset).model_dump(),
        versions=versions,
        references=assets_service.list_references(db, asset),
        quality_checks=assets_service.list_quality_checks(db, asset),
    )
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


@router.post("/projects/{project_id}/asset-uploads", status_code=201)
def create_asset_upload(
    project_id: UUID,
    payload: DirectUploadCreate,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _project(db, principal, project_id, need="creation.write")
    settings = get_settings()
    session, upload_url = assets_service.create_direct_upload(
        db,
        project_id=project_id,
        payload=payload,
        created_by=principal.user.id,
        public_base_url=settings.public_base_url,
        api_prefix=settings.api_v1_prefix,
    )
    db.commit()
    return envelope(
        DirectUploadRead(
            upload_id=session.id,
            upload_url=upload_url,
            storage_key=session.storage_key,
            filename=session.filename,
            mime_type=session.mime_type,
            expires_at=session.expires_at,
            max_bytes=session.max_bytes,
            status=session.status,
        ).model_dump(mode="json")
    )


@router.put("/asset-uploads/{upload_id}/content")
async def put_asset_upload_content(
    upload_id: UUID,
    request: Request,
    token: str = Query(min_length=1),
    db: Session = Depends(get_db),
) -> dict:
    body = await request.body()
    session = assets_service.upload_direct_content(
        db,
        upload_id=upload_id,
        token=token,
        data=body,
        mime_type=request.headers.get("content-type"),
    )
    db.commit()
    return envelope(
        {
            "upload_id": str(session.id),
            "status": session.status,
            "checksum": session.checksum,
            "size_bytes": session.size_bytes,
        }
    )


@router.post("/projects/{project_id}/asset-uploads/{upload_id}/complete", status_code=201)
def complete_asset_upload(
    project_id: UUID,
    upload_id: UUID,
    payload: DirectUploadComplete,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    project = _project(db, principal, project_id, need="creation.write")
    session = assets_service.get_upload_session_or_404(db, upload_id)
    if session.project_id != project.id:
        raise not_found("Asset upload session")
    asset = assets_service.complete_direct_upload(
        db,
        project=project,
        session=session,
        checksum=payload.checksum,
        title=payload.title,
        actor_user_id=principal.user.id,
    )
    db.commit()
    return envelope(AssetRead.model_validate(asset).model_dump(mode="json"))


@router.post("/assets/{asset_id}/qc", status_code=201)
def run_asset_qc(
    asset_id: UUID,
    payload: AssetQCRequest,
    principal: Principal = Depends(require_permission("asset.manage")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id, need="asset.manage")
    check = assets_service.run_asset_qc(
        db,
        asset=asset,
        result=payload.result,
        note=payload.note,
        actor_user_id=principal.user.id,
    )
    db.commit()
    return envelope(
        {
            "asset": AssetRead.model_validate(asset).model_dump(mode="json"),
            "check": AssetQCCheckRead.model_validate(check).model_dump(mode="json"),
        }
    )


@router.patch("/assets/{asset_id}/authorization")
def update_asset_authorization(
    asset_id: UUID,
    payload: AuthorizationUpdate,
    principal: Principal = Depends(require_permission("asset.manage")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id, need="asset.manage")
    assets_service.update_authorization(
        db,
        asset=asset,
        status=payload.status,
        scope=payload.scope,
        note=payload.note,
        actor_user_id=principal.user.id,
    )
    db.commit()
    return envelope(AssetRead.model_validate(asset).model_dump(mode="json"))


@router.post("/assets/{asset_id}/formalize")
def formalize_asset(
    asset_id: UUID,
    principal: Principal = Depends(require_permission("asset.manage")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id, need="asset.manage")
    asset, version = assets_service.formalize_asset(
        db, asset=asset, actor_user_id=principal.user.id
    )
    db.commit()
    return envelope(
        {
            "asset": AssetRead.model_validate(asset).model_dump(mode="json"),
            "version": AssetVersionRead.model_validate(version).model_dump(mode="json"),
        }
    )


@router.get("/assets/{asset_id}/references")
def list_asset_references(
    asset_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id)
    references = assets_service.list_references(db, asset)
    return envelope(
        {
            "asset_id": str(asset.id),
            "reference_count": asset.reference_count,
            "items": [
                AssetReferenceRead.model_validate(item).model_dump(mode="json")
                for item in references
            ],
        }
    )


@router.post("/assets/{asset_id}/references", status_code=201)
def add_asset_reference(
    asset_id: UUID,
    payload: AssetReferenceCreate,
    principal: Principal = Depends(require_permission("asset.manage")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id, need="asset.manage")
    reference = assets_service.add_reference(
        db,
        asset=asset,
        ref_type=payload.ref_type,
        ref_id=payload.ref_id,
        note=payload.note,
    )
    db.commit()
    return envelope(
        {
            "asset_id": str(asset.id),
            "reference_count": asset.reference_count,
            "reference": AssetReferenceRead.model_validate(reference).model_dump(mode="json"),
        }
    )


@router.delete("/assets/{asset_id}/references/{reference_id}")
def delete_asset_reference(
    asset_id: UUID,
    reference_id: UUID,
    principal: Principal = Depends(require_permission("asset.manage")),
    db: Session = Depends(get_db),
) -> dict:
    asset = assets_service.get_asset_or_404(db, asset_id)
    _project(db, principal, asset.project_id, need="asset.manage")
    reference = assets_service.get_reference_or_404(
        db, asset=asset, reference_id=reference_id
    )
    assets_service.remove_reference(db, asset=asset, reference=reference)
    db.commit()
    return envelope({"asset_id": str(asset.id), "reference_count": asset.reference_count})


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
