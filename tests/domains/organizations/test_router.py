import uuid


def test_organization_detail_and_department_parent_are_organization_scoped(
    client, admin, db_session
):
    from app.domains.organizations.models import Department, Organization, OrganizationMember
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
    parent = Department(organization_id=other_org.id, name="Private department")
    db_session.add(parent)
    db_session.flush()

    detail = client.get(
        f"/api/v1/organizations/{other_org.id}", headers=admin["headers"]
    )
    assert detail.status_code == 404

    child = client.post(
        "/api/v1/organizations/departments",
        headers=admin["headers"],
        json={"name": "Cross-org child", "parent_id": str(parent.id)},
    )
    assert child.status_code == 404
    assert child.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
