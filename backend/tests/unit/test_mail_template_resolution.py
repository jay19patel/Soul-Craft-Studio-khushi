"""
* tests/unit/test_mail_template_resolution.py
? MailService resolves ``templates/email/*.html`` from the app first, then backbone package defaults.
"""

import pytest

from backbone.config import BackboneSettings
from backbone.services.mail import MailService


@pytest.fixture
def isolated_mail_settings(tmp_path, monkeypatch) -> BackboneSettings:
    """Use a clean cwd with no project ``templates/`` so only backbone defaults apply."""
    monkeypatch.chdir(tmp_path)
    return BackboneSettings(
        ENVIRONMENT="testing",
        SECRET_KEY="test-secret-key-for-unit-tests-only-256bits",
        EMAIL_ENABLED=False,
    )


def test_welcome_email_renders_backbone_default_when_app_has_no_template(isolated_mail_settings):
    mail = MailService(app_settings=isolated_mail_settings)
    html = mail.render_template(
        "welcome.html",
        {"full_name": "Test User", "app_name": "My App", "app_url": "https://example.com"},
    )
    assert "backbone-email-default: welcome" in html
    assert "My App" in html
    assert "Test User" in html


def test_app_template_overrides_backbone_default(tmp_path, monkeypatch):
    """Same relative path under cwd ``templates/email/`` wins over packaged defaults."""
    monkeypatch.chdir(tmp_path)
    email_dir = tmp_path / "templates" / "email"
    email_dir.mkdir(parents=True)
    (email_dir / "welcome.html").write_text(
        "<html><body>APP_CUSTOM_WELCOME_OVERRIDE {{ full_name }}</body></html>",
        encoding="utf-8",
    )

    settings = BackboneSettings(
        ENVIRONMENT="testing",
        SECRET_KEY="test-secret-key-for-unit-tests-only-256bits",
        EMAIL_ENABLED=False,
    )
    mail = MailService(app_settings=settings)
    html = mail.render_template(
        "welcome.html",
        {"full_name": "Pat", "app_name": "X", "app_url": "http://localhost"},
    )
    assert "APP_CUSTOM_WELCOME_OVERRIDE" in html
    assert "Pat" in html
    assert "backbone-email-default: welcome" not in html


def test_verify_and_password_reset_defaults_render(isolated_mail_settings):
    mail = MailService(app_settings=isolated_mail_settings)
    verify_html = mail.render_template(
        "verify_email.html",
        {"full_name": "A", "verification_url": "https://x/verify?t=1", "app_name": "App"},
    )
    assert "backbone-email-default: verify_email" in verify_html
    reset_html = mail.render_template(
        "password_reset.html",
        {"full_name": "B", "reset_url": "https://x/reset?t=1", "app_name": "App"},
    )
    assert "backbone-email-default: password_reset" in reset_html
