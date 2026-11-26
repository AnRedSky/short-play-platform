"""Queries for the B-08 post-production domain."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.delivery.models import (
    DeliveryPackage,
    EpisodeOutput,
    FinalReview,
    TimelineVersion,
)
from app.domains.quality.models import QualityReport


def get_timeline(db: Session, timeline_id: UUID) -> TimelineVersion | None:
    return db.get(TimelineVersion, timeline_id)


def list_timelines(
    db: Session, project_id: UUID, episode_number: int | None = None
) -> list[TimelineVersion]:
    query = select(TimelineVersion).where(TimelineVersion.project_id == project_id)
    if episode_number is not None:
        query = query.where(TimelineVersion.episode_number == episode_number)
    return list(
        db.scalars(
            query.order_by(
                TimelineVersion.episode_number,
                TimelineVersion.version_number.desc(),
            )
        ).all()
    )


def next_timeline_version(db: Session, project_id: UUID, episode_number: int) -> int:
    current = db.scalar(
        select(func.max(TimelineVersion.version_number)).where(
            TimelineVersion.project_id == project_id,
            TimelineVersion.episode_number == episode_number,
        )
    )
    return int(current or 0) + 1


def latest_timeline(
    db: Session, project_id: UUID, episode_number: int
) -> TimelineVersion | None:
    return db.scalar(
        select(TimelineVersion)
        .where(
            TimelineVersion.project_id == project_id,
            TimelineVersion.episode_number == episode_number,
        )
        .order_by(TimelineVersion.version_number.desc())
        .limit(1)
    )


def list_outputs(db: Session, project_id: UUID) -> list[EpisodeOutput]:
    return list(
        db.scalars(
            select(EpisodeOutput)
            .where(EpisodeOutput.project_id == project_id)
            .order_by(EpisodeOutput.episode_number, EpisodeOutput.created_at.desc())
        ).all()
    )


def get_output(db: Session, output_id: UUID) -> EpisodeOutput | None:
    return db.get(EpisodeOutput, output_id)


def find_output(db: Session, project_id: UUID, episode_number: int, timeline_id: UUID):
    return db.scalar(
        select(EpisodeOutput).where(
            EpisodeOutput.project_id == project_id,
            EpisodeOutput.episode_number == episode_number,
            EpisodeOutput.timeline_version_id == timeline_id,
        )
    )


def list_reviews(db: Session, project_id: UUID) -> list[FinalReview]:
    return list(
        db.scalars(
            select(FinalReview)
            .where(FinalReview.project_id == project_id)
            .order_by(FinalReview.created_at.desc())
        ).all()
    )


def latest_review(db: Session, project_id: UUID) -> FinalReview | None:
    return db.scalar(
        select(FinalReview)
        .where(FinalReview.project_id == project_id)
        .order_by(FinalReview.created_at.desc())
        .limit(1)
    )


def latest_quality_report(db: Session, project_id: UUID) -> QualityReport | None:
    return db.scalar(
        select(QualityReport)
        .where(QualityReport.project_id == project_id)
        .order_by(QualityReport.created_at.desc())
        .limit(1)
    )


def get_package(db: Session, package_id: UUID) -> DeliveryPackage | None:
    return db.get(DeliveryPackage, package_id)


def find_package_for_project(db: Session, project_id: UUID) -> DeliveryPackage | None:
    return db.scalar(
        select(DeliveryPackage).where(DeliveryPackage.project_id == project_id).limit(1)
    )


def list_packages(
    db: Session, project_ids: list[UUID], project_id: UUID | None = None
) -> list[DeliveryPackage]:
    query = select(DeliveryPackage).where(DeliveryPackage.project_id.in_(project_ids))
    if project_id is not None:
        query = query.where(DeliveryPackage.project_id == project_id)
    return list(db.scalars(query.order_by(DeliveryPackage.created_at.desc())).all())
