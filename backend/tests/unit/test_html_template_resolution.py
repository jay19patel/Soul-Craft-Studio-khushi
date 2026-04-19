"""
* tests/unit/test_html_template_resolution.py
? Admin and public page Jinja2 loaders: app ``templates/`` first, then packaged ``backbone/templates/``.
"""

import os
from pathlib import Path

import pytest
from jinja2 import ChoiceLoader, Environment, FileSystemLoader

import backbone


def _backbone_package_dir() -> Path:
    return Path(backbone.__file__).resolve().parent


def _admin_search_paths_from_cwd(tmp_path: Path) -> list[str]:
    """Mirror ``_build_admin_templates`` path selection (existence filter)."""
    user_admin = tmp_path / "templates" / "admin"
    backbone_admin = _backbone_package_dir() / "templates" / "admin"
    return [p for p in (str(user_admin), str(backbone_admin)) if os.path.exists(p)]


def _pages_search_paths_from_cwd(tmp_path: Path) -> list[str]:
    """Mirror ``_build_pages_templates`` path selection."""
    user_root = tmp_path / "templates"
    backbone_root = _backbone_package_dir() / "templates"
    return [p for p in (str(user_root), str(backbone_root)) if os.path.exists(p)]


@pytest.fixture
def isolated_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    return tmp_path


def test_admin_login_renders_backbone_default(isolated_cwd):
    search_paths = _admin_search_paths_from_cwd(isolated_cwd)
    assert search_paths, "backbone/templates/admin must exist"
    env = Environment(loader=ChoiceLoader([FileSystemLoader(p) for p in search_paths]))
    html = env.get_template("login.html").render(
        superuser_exists=True,
        error=None,
        default_email="",
        default_password="",
    )
    assert "backbone-admin-default: login" in html


def test_admin_login_app_override_wins(isolated_cwd):
    user_admin = isolated_cwd / "templates" / "admin"
    user_admin.mkdir(parents=True)
    (user_admin / "login.html").write_text(
        "<!DOCTYPE html><html><body>APP_ADMIN_LOGIN_OVERRIDE</body></html>",
        encoding="utf-8",
    )
    search_paths = _admin_search_paths_from_cwd(isolated_cwd)
    env = Environment(loader=ChoiceLoader([FileSystemLoader(p) for p in search_paths]))
    html = env.get_template("login.html").render(
        superuser_exists=False,
        error=None,
        default_email="",
        default_password="",
    )
    assert "APP_ADMIN_LOGIN_OVERRIDE" in html
    assert "backbone-admin-default: login" not in html


def test_public_reset_password_page_includes_backbone_base_public(isolated_cwd):
    search_paths = _pages_search_paths_from_cwd(isolated_cwd)
    assert search_paths, "backbone/templates must exist"
    env = Environment(loader=ChoiceLoader([FileSystemLoader(p) for p in search_paths]))
    html = env.get_template("pages/auth/reset_password_request.html").render(
        submitted=False,
        success=False,
        error=None,
        message="",
        submitted_email="",
        reset_token=None,
        reset_url="",
    )
    assert "backbone-pages-default: base_public" in html


def test_pages_user_guide_override_wins(isolated_cwd):
    user_pages = isolated_cwd / "templates" / "pages"
    user_pages.mkdir(parents=True)
    (user_pages / "user_guide.html").write_text(
        '{% extends "pages/base_public.html" %}'
        "{% block content %}CUSTOM_USER_GUIDE_BODY{% endblock %}",
        encoding="utf-8",
    )
    search_paths = _pages_search_paths_from_cwd(isolated_cwd)
    env = Environment(loader=ChoiceLoader([FileSystemLoader(p) for p in search_paths]))
    html = env.get_template("pages/user_guide.html").render(
        site_name="Test",
        api_base_url="http://localhost/api",
    )
    assert "CUSTOM_USER_GUIDE_BODY" in html
    assert "backbone-pages-default: user_guide" not in html
