from app.config.settings import Settings


def test_settings_have_safe_development_defaults() -> None:
    settings = Settings(_env_file=None)
    assert settings.app_name == "short-play-platform"
    assert settings.api_v1_prefix == "/api/v1"


def test_debug_flag_reads_documented_environment_name() -> None:
    settings = Settings(_env_file=None, APP_DEBUG=True)
    assert settings.debug is True
