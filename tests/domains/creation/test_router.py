import uuid

from fastapi.testclient import TestClient


def _headers(admin: dict) -> dict:
    return admin["headers"]


def _create_project(client: TestClient, admin: dict) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=_headers(admin),
        json={"code": f"p-{uuid.uuid4().hex[:6]}", "title": "Pilot Drama"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_creation_flow_from_episode_to_shot_contract(client, admin):
    project = _create_project(client, admin)
    project_id = project["id"]

    episode = client.post(
        f"/api/v1/projects/{project_id}/episodes",
        headers=_headers(admin),
        json={"episode_number": 1, "title": "Pilot", "synopsis": "A hook in ten seconds."},
    )
    assert episode.status_code == 201, episode.text
    episode_id = episode.json()["data"]["id"]

    # Episode numbering is unique per project.
    duplicate_episode = client.post(
        f"/api/v1/projects/{project_id}/episodes",
        headers=_headers(admin),
        json={"episode_number": 1, "title": "Duplicate"},
    )
    assert duplicate_episode.status_code == 409

    story = client.post(
        f"/api/v1/projects/{project_id}/stories",
        headers=_headers(admin),
        json={"title": "Season One", "logline": "Revenge in a small town."},
    )
    assert story.status_code == 201, story.text

    bible_v1 = client.post(
        f"/api/v1/projects/{project_id}/story-bibles",
        headers=_headers(admin),
        json={"content": {"world": "coastal town", "tone": "noir"}},
    )
    assert bible_v1.status_code == 201
    assert bible_v1.json()["data"]["version_number"] == 1

    bible_v2 = client.post(
        f"/api/v1/projects/{project_id}/story-bibles",
        headers=_headers(admin),
        json={"content": {"world": "coastal town", "tone": "noir", "arc": "betrayal"}},
    )
    assert bible_v2.status_code == 201
    assert bible_v2.json()["data"]["version_number"] == 2

    script = client.post(
        f"/api/v1/episodes/{episode_id}/scripts",
        headers=_headers(admin),
        json={"title": "Ep1 Draft"},
    )
    assert script.status_code == 201, script.text
    script_id = script.json()["data"]["id"]

    version_one = client.post(
        f"/api/v1/scripts/{script_id}/versions",
        headers=_headers(admin),
        json={"content": "INT. HARBOR - NIGHT"},
    )
    assert version_one.status_code == 201
    assert version_one.json()["data"]["version_number"] == 1

    version_two = client.post(
        f"/api/v1/scripts/{script_id}/versions",
        headers=_headers(admin),
        json={"content": "INT. HARBOR - NIGHT (revised)"},
    )
    assert version_two.status_code == 201
    assert version_two.json()["data"]["version_number"] == 2

    versions = client.get(f"/api/v1/scripts/{script_id}/versions", headers=_headers(admin))
    assert [row["version_number"] for row in versions.json()["data"]] == [1, 2]

    version_id = version_two.json()["data"]["id"]
    scene = client.post(
        f"/api/v1/script-versions/{version_id}/scenes",
        headers=_headers(admin),
        json={"scene_number": 1, "location": "Harbor", "time_of_day": "NIGHT"},
    )
    assert scene.status_code == 201
    scene_id = scene.json()["data"]["id"]

    duplicate_scene = client.post(
        f"/api/v1/script-versions/{version_id}/scenes",
        headers=_headers(admin),
        json={"scene_number": 1, "location": "Pier"},
    )
    assert duplicate_scene.status_code == 409

    dialogue = client.post(
        f"/api/v1/script-scenes/{scene_id}/dialogues",
        headers=_headers(admin),
        json={"order_number": 1, "character_name": "Lin", "content": "You came back."},
    )
    assert dialogue.status_code == 201, dialogue.text

    duplicate_dialogue = client.post(
        f"/api/v1/script-scenes/{scene_id}/dialogues",
        headers=_headers(admin),
        json={"order_number": 1, "character_name": "Wei", "content": "I never left."},
    )
    assert duplicate_dialogue.status_code == 409

    character = client.post(
        f"/api/v1/projects/{project_id}/characters",
        headers=_headers(admin),
        json={"name": "Lin", "description": "Harbor detective"},
    )
    assert character.status_code == 201
    character_id = character.json()["data"]["id"]

    character_version = client.post(
        f"/api/v1/characters/{character_id}/versions",
        headers=_headers(admin),
        json={"appearance": "short hair, raincoat", "prompt": "noir detective"},
    )
    assert character_version.status_code == 201
    assert character_version.json()["data"]["version_number"] == 1

    second_character_version = client.post(
        f"/api/v1/characters/{character_id}/versions",
        headers=_headers(admin),
        json={"appearance": "short hair, black coat", "prompt": "noir detective v2"},
    )
    assert second_character_version.status_code == 201
    assert second_character_version.json()["data"]["version_number"] == 2

    detail = client.get(f"/api/v1/characters/{character_id}", headers=_headers(admin))
    assert [row["version_number"] for row in detail.json()["data"]["versions"]] == [1, 2]

    production_scene = client.post(
        f"/api/v1/projects/{project_id}/scenes",
        headers=_headers(admin),
        json={"name": "Harbor Docks", "description": "Wet concrete at night"},
    )
    assert production_scene.status_code == 201
    production_scene_id = production_scene.json()["data"]["id"]

    prop = client.post(
        f"/api/v1/projects/{project_id}/props",
        headers=_headers(admin),
        json={"name": "Case File", "description": "Water damaged"},
    )
    assert prop.status_code == 201
    prop_id = prop.json()["data"]["id"]

    prop_version = client.post(
        f"/api/v1/props/{prop_id}/versions",
        headers=_headers(admin),
        json={"appearance": "folded paper", "prompt": "noir prop"},
    )
    assert prop_version.status_code == 201

    storyboard = client.post(
        f"/api/v1/episodes/{episode_id}/storyboards",
        headers=_headers(admin),
        json={"version_number": 1},
    )
    assert storyboard.status_code == 201
    storyboard_id = storyboard.json()["data"]["id"]

    shot = client.post(
        f"/api/v1/storyboards/{storyboard_id}/shots",
        headers=_headers(admin),
        json={
            "shot_number": 1,
            "scene_id": production_scene_id,
            "shot_size": "wide",
            "description": "Harbor establishing shot",
        },
    )
    assert shot.status_code == 201, shot.text
    shot_id = shot.json()["data"]["id"]

    duplicate_shot = client.post(
        f"/api/v1/storyboards/{storyboard_id}/shots",
        headers=_headers(admin),
        json={"shot_number": 1, "description": "Duplicate"},
    )
    assert duplicate_shot.status_code == 409

    contract_v1 = client.post(
        f"/api/v1/shots/{shot_id}/contracts",
        headers=_headers(admin),
        json={"payload": {"duration_seconds": 5, "camera": "static"}},
    )
    assert contract_v1.status_code == 201
    assert contract_v1.json()["data"]["version_number"] == 1

    contract_v2 = client.post(
        f"/api/v1/shots/{shot_id}/contracts",
        headers=_headers(admin),
        json={"payload": {"duration_seconds": 8, "camera": "slow_push"}},
    )
    assert contract_v2.status_code == 201
    assert contract_v2.json()["data"]["version_number"] == 2

    contracts = client.get(f"/api/v1/shots/{shot_id}/contracts", headers=_headers(admin))
    assert [row["payload"]["duration_seconds"] for row in contracts.json()["data"]] == [5, 8]

    audit = client.get(
        "/api/v1/audit-logs", headers=_headers(admin), params={"action": "shot.contract_created"}
    )
    assert audit.status_code == 200
    assert len(audit.json()["data"]) == 2


def test_creation_domain_denies_non_project_members(client, admin):
    project = _create_project(client, admin)
    project_id = project["id"]

    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={"code": "outsider", "name": "Outsider", "permissions": ["projects:read"]},
    ).json()["data"]
    email = f"outsider-{uuid.uuid4().hex[:8]}@example.com"
    password = "MemberPassword1"
    created = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Outsider",
            "password": password,
            "role_ids": [role["id"]],
        },
    )
    assert created.status_code == 201, created.text

    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()[
        "data"
    ]["access_token"]
    outsider_headers = {"Authorization": f"Bearer {token}"}

    denied = client.post(
        f"/api/v1/projects/{project_id}/episodes",
        headers=outsider_headers,
        json={"episode_number": 2, "title": "Sneaky"},
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"

    listed = client.get(f"/api/v1/projects/{project_id}/episodes", headers=outsider_headers)
    assert listed.status_code == 403

    # The outsider cannot reach an episode through a guessed identifier either.
    episode = client.post(
        f"/api/v1/projects/{project_id}/episodes",
        headers=admin["headers"],
        json={"episode_number": 1, "title": "Real"},
    ).json()["data"]
    episode_read = client.get(f"/api/v1/episodes/{episode['id']}", headers=outsider_headers)
    assert episode_read.status_code == 403



def test_shot_cannot_reference_scene_from_another_project(client, admin):
    project_a = _create_project(client, admin)
    project_b = _create_project(client, admin)
    episode = client.post(
        f"/api/v1/projects/{project_a['id']}/episodes",
        headers=admin["headers"],
        json={"episode_number": 1, "title": "Project A episode"},
    ).json()["data"]
    storyboard = client.post(
        f"/api/v1/episodes/{episode['id']}/storyboards",
        headers=admin["headers"],
        json={"version_number": 1},
    ).json()["data"]
    scene = client.post(
        f"/api/v1/projects/{project_b['id']}/scenes",
        headers=admin["headers"],
        json={"name": "Private Project B location"},
    ).json()["data"]
    character = client.post(
        f"/api/v1/projects/{project_b['id']}/characters",
        headers=admin["headers"],
        json={"name": "Private Project B character"},
    ).json()["data"]

    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={
            "code": f"creation-member-{uuid.uuid4().hex[:8]}",
            "name": "Creation member",
            "permissions": ["projects:read", "projects:write"],
        },
    ).json()["data"]
    email = f"creation-member-{uuid.uuid4().hex[:8]}@example.com"
    password = "MemberPassword1"
    user = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Project A creator",
            "password": password,
            "role_ids": [role["id"]],
        },
    ).json()["data"]
    token = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    ).json()["data"]["access_token"]
    member_headers = {"Authorization": f"Bearer {token}"}
    membership = client.post(
        f"/api/v1/projects/{project_a['id']}/members",
        headers=admin["headers"],
        json={"user_id": user["id"], "project_role": "artist"},
    )
    assert membership.status_code == 201, membership.text

    foreign_character = client.get(
        f"/api/v1/characters/{character['id']}", headers=member_headers
    )
    assert foreign_character.status_code == 403
    foreign_version = client.post(
        f"/api/v1/characters/{character['id']}/versions",
        headers=member_headers,
        json={"appearance": "attempted cross-project change"},
    )
    assert foreign_version.status_code == 403

    response = client.post(
        f"/api/v1/storyboards/{storyboard['id']}/shots",
        headers=member_headers,
        json={"shot_number": 1, "scene_id": scene["id"], "description": "Cross-project ref"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"
