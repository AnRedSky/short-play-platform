"""Users domain: business rules with a mocked repository."""

import uuid

import pytest

from app.domains.users import service
from app.public.exceptions import ConflictError, NotFoundError


def test_get_user_or_404_raises_not_found(monkeypatch):
    monkeypatch.setattr(service.users_repo, "get_user_by_id", lambda db, user_id: None)
    with pytest.raises(NotFoundError):
        service.get_user_or_404(db=None, user_id=uuid.uuid4())


def test_create_user_rejects_duplicate_email(monkeypatch):
    monkeypatch.setattr(
        service.users_repo, "get_user_by_email", lambda db, email: object()
    )
    with pytest.raises(ConflictError):
        service.create_user(
            db=None,
            email="dup@example.com",
            full_name="Duplicated",
            password="CorrectHorseBattery1",
            organization_id=uuid.uuid4(),
        )


def test_create_user_composes_repository_membership_and_roles(monkeypatch):
    calls: dict[str, object] = {}

    class FakeUser:
        id = uuid.uuid4()
        email = "new@example.com"

    monkeypatch.setattr(service.users_repo, "get_user_by_email", lambda db, email: None)

    def fake_create_row(db, *, email, full_name, password_hash):
        calls["create_row"] = (email, full_name)
        assert password_hash and password_hash != "CorrectHorseBattery1"
        return FakeUser()

    monkeypatch.setattr(service.users_repo, "create_user_row", fake_create_row)

    def fake_add_member(db, *, organization_id, user_id, department_id=None):
        calls["add_member"] = (organization_id, user_id)

    monkeypatch.setattr(service.organizations_service, "add_member", fake_add_member)

    def fake_assign(db, *, role_id, organization_id, user_id):
        calls.setdefault("assigned", []).append((role_id, user_id))

    monkeypatch.setattr(service.roles_service, "assign_role_to_user", fake_assign)

    organization_id = uuid.uuid4()
    role_id = uuid.uuid4()
    user = service.create_user(
        db=None,
        email=" New@Example.com ",
        full_name="New User",
        password="CorrectHorseBattery1",
        organization_id=organization_id,
        role_ids=[role_id],
    )

    assert calls["create_row"] == ("new@example.com", "New User")
    assert calls["add_member"] == (organization_id, user.id)
    assert calls["assigned"] == [(role_id, user.id)]


def test_dispatch_welcome_notification_is_idempotent(monkeypatch):
    seen: set[str] = set()
    monkeypatch.setattr(service.users_repo, "get_user_by_id", lambda db, user_id: type(
        "U", (), {"id": user_id, "email": "x@example.com"}
    )())
    monkeypatch.setattr(
        service.audit_repo,
        "find_by_action_and_resource",
        lambda db, **kwargs: object() if kwargs["resource_id"] in seen else None,
    )

    def fake_record(db, *, actor_user_id, action, resource_type, resource_id, details):
        seen.add(resource_id)

    monkeypatch.setattr(service.audit_service, "record", fake_record)

    user_id = uuid.uuid4()
    assert service.dispatch_welcome_notification(None, user_id) is True
    assert service.dispatch_welcome_notification(None, user_id) is False
