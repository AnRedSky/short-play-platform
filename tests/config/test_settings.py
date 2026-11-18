from pathlib import Path

import pytest

from app.config import settings as settings_module
from app.config.settings import Settings, env_files


def test_env_files_are_absolute_and_ordered_lowest_precedence_first(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(settings_module, "ENV_FILE_DIR", tmp_path)
    monkeypatch.setenv("APP_ENV", "production")

    files = env_files()

    assert [Path(item).name for item in files] == [".env.example", ".env", ".env.production"]
    assert all(Path(item).parent == tmp_path for item in files)
    assert all(Path(item).is_absolute() for item in files)


def test_app_env_falls_back_to_the_template(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setattr(settings_module, "ENV_FILE_DIR", tmp_path)
    (tmp_path / ".env.example").write_text("APP_ENV=test\n", encoding="utf-8")

    assert settings_module._active_environment().value == "test"


def test_dotenv_beats_the_template_when_both_define_app_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setattr(settings_module, "ENV_FILE_DIR", tmp_path)
    (tmp_path / ".env.example").write_text("APP_ENV=test\n", encoding="utf-8")
    (tmp_path / ".env").write_text("APP_ENV=production\n", encoding="utf-8")

    assert settings_module._active_environment().value == "production"


def test_settings_read_the_three_layers_in_priority_order(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("API_PORT", raising=False)
    files = {
        ".env.example": 1111,
        ".env": 2222,
        ".env.development": 3333,
    }
    for name, port in files.items():
        (tmp_path / name).write_text(f"API_PORT={port}\n", encoding="utf-8")

    layered = tuple(str(tmp_path / name) for name in files)
    settings = Settings(_env_file=layered)

    # The environment specific file wins over .env, which wins over the template.
    assert settings.api_port == 3333


def test_template_only_fills_keys_missing_from_local_files(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("API_PORT", raising=False)
    (tmp_path / ".env.example").write_text(
        "API_PORT=1111\nSECRET_KEY=template-secret\n", encoding="utf-8"
    )
    (tmp_path / ".env").write_text("API_PORT=2222\n", encoding="utf-8")

    settings = Settings(_env_file=(str(tmp_path / ".env.example"), str(tmp_path / ".env")))

    assert settings.api_port == 2222
    assert settings.secret_key == "template-secret"


def test_process_environment_beats_every_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / ".env.example").write_text("API_PORT=1111\n", encoding="utf-8")
    monkeypatch.setenv("API_PORT", "4444")

    settings = Settings(_env_file=str(tmp_path / ".env.example"))

    assert settings.api_port == 4444


def test_settings_have_safe_development_defaults() -> None:
    settings = Settings(_env_file=None)
    assert settings.app_name == "short-play-platform"
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.api_port == 8000


def test_debug_flag_reads_documented_environment_name() -> None:
    settings = Settings(_env_file=None, APP_DEBUG=True)
    assert settings.debug is True
