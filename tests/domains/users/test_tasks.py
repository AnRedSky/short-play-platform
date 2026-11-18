"""Users domain: task behaviour and idempotency, with a mocked service."""

import uuid
from contextlib import contextmanager

from app.domains.users import tasks


def _fake_session_scope():
    @contextmanager
    def scope():
        yield None

    return scope


def test_send_welcome_email_calls_service(monkeypatch):
    monkeypatch.setattr(tasks, "session_scope", _fake_session_scope())
    calls: list[uuid.UUID] = []
    monkeypatch.setattr(
        tasks.service,
        "dispatch_welcome_notification",
        lambda db, user_id: calls.append(user_id) or True,
    )

    user_id = uuid.uuid4()
    result = tasks.send_welcome_email.run(str(user_id))

    assert calls == [user_id]
    assert result == {"user_id": str(user_id), "dispatched": True}


def test_send_welcome_email_is_idempotent(monkeypatch):
    monkeypatch.setattr(tasks, "session_scope", _fake_session_scope())
    delivered: set[uuid.UUID] = set()

    def dispatch(db, user_id):
        if user_id in delivered:
            return False
        delivered.add(user_id)
        return True

    monkeypatch.setattr(tasks.service, "dispatch_welcome_notification", dispatch)

    user_id = uuid.uuid4()
    first = tasks.send_welcome_email.run(str(user_id))
    second = tasks.send_welcome_email.run(str(user_id))

    assert first["dispatched"] is True
    assert second["dispatched"] is False
    assert delivered == {user_id}
