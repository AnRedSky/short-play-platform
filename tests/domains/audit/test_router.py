import uuid


def test_audit_log_list_is_scoped_to_the_active_organization(client, admin, db_session):
    from app.domains.audit import repository as audit_repository
    from app.domains.organizations.models import Organization, OrganizationMember
    from app.domains.users.models import User

    other_org = Organization(name="Other studio", slug=f"other-{uuid.uuid4().hex[:8]}")
    db_session.add(other_org)
    db_session.flush()
    other_user = User(
        email=f"other-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Other organization user",
        password_hash="not-used-in-this-test",
    )
    db_session.add(other_user)
    db_session.flush()
    db_session.add(OrganizationMember(organization_id=other_org.id, user_id=other_user.id))
    audit_repository.add_log(
        db_session,
        actor_user_id=other_user.id,
        action="other_org.secret_action",
        resource_type="private_resource",
        resource_id="private-id",
    )
    db_session.flush()

    response = client.get("/api/v1/audit-logs", headers=admin["headers"])
    assert response.status_code == 200
    actions = [item["action"] for item in response.json()["data"]]
    assert "other_org.secret_action" not in actions
