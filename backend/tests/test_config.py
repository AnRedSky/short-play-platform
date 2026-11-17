from apps.api.config import Settings


def test_settings_have_safe_development_defaults() -> None:
    settings = Settings(_env_file=None)
    assert settings.app_name == "short-play-platform"
    assert settings.api_v1_prefix == "/api/v1"
