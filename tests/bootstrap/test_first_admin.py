from app.bootstrap.lifespan import _validate_bootstrap_settings
from app.config.environments import Environment
from app.config.settings import Settings


def _settings(**overrides) -> Settings:
    values = {
        "app_env": Environment.DEV,
        "bootstrap_admin_enabled": True,
        "bootstrap_admin_email": "admin@localhost",
        "bootstrap_admin_password": "ChangeMeNow-2026!",
        "bootstrap_admin_full_name": "Platform Administrator",
        "bootstrap_organization_name": "Short Play Studio",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_development_bootstrap_accepts_documented_local_credentials() -> None:
    _validate_bootstrap_settings(_settings())


def test_bootstrap_disabled_does_not_require_credentials() -> None:
    settings = _settings(bootstrap_admin_enabled=False, bootstrap_admin_password="")
    _validate_bootstrap_settings(settings)


def test_enabled_bootstrap_requires_a_password() -> None:
    settings = _settings(bootstrap_admin_password="")
    try:
        _validate_bootstrap_settings(settings)
    except RuntimeError as error:
        assert "BOOTSTRAP_ADMIN_PASSWORD" in str(error)
    else:
        raise AssertionError("expected missing bootstrap password to be rejected")


def test_production_rejects_the_development_bootstrap_password() -> None:
    settings = _settings(app_env=Environment.PROD, secret_key="a-unique-production-secret")
    try:
        _validate_bootstrap_settings(settings)
    except RuntimeError as error:
        assert "unique BOOTSTRAP_ADMIN_PASSWORD" in str(error)
    else:
        raise AssertionError("expected development password to be rejected in production")


def test_production_rejects_the_default_secret_key() -> None:
    settings = _settings(
        app_env=Environment.PROD,
        bootstrap_admin_password="A-unique-production-password-123!",
    )
    try:
        _validate_bootstrap_settings(settings)
    except RuntimeError as error:
        assert "unique SECRET_KEY" in str(error)
    else:
        raise AssertionError("expected default secret key to be rejected in production")


def test_production_accepts_explicit_unique_credentials() -> None:
    settings = _settings(
        app_env=Environment.PROD,
        bootstrap_admin_password="A-unique-production-password-123!",
        secret_key="a-unique-production-secret",
    )
    _validate_bootstrap_settings(settings)
