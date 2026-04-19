"""
* backbone/cli/main.py
? Backbone CLI — manage your app from the command line.

Usage:
    python -m backbone.cli --help
    python -m backbone.cli create-admin
    python -m backbone.cli change-password admin@example.com
    python -m backbone.cli flush-db
    python -m backbone.cli worker
    python -m backbone.cli run-tests
"""

import asyncio
import subprocess
import sys
from typing import cast

import typer
from beanie import Document
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(
    name="backbone",
    help="Backbone FastAPI CLI — manage your application.",
    add_completion=False,
)
console = Console()


# ── Shared DB Bootstrap ────────────────────────────────────────────────────


async def _bootstrap_database() -> None:
    """Initialize the database connection for CLI operations."""
    from backbone.config import settings
    from backbone.core.database import init_database
    from backbone.domain.models import Attachment, Email, LogEntry, Session, Store, Task, User

    await init_database(
        [User, Session, LogEntry, Attachment, Store, Task, Email],
        app_settings=settings,
    )


# ── create-admin ───────────────────────────────────────────────────────────


@app.command("create-admin")
def create_admin(
    email: str = typer.Option(..., prompt="Admin email"),
    password: str = typer.Option(
        ..., prompt="Admin password", confirmation_prompt=True, hide_input=True
    ),
    full_name: str = typer.Option("Administrator", prompt="Full name"),
) -> None:
    """Create a new admin user or reset an existing admin's password."""

    async def _run() -> None:
        await _bootstrap_database()
        from backbone.core.enums import UserRole
        from backbone.services.auth import AuthService

        auth_service = AuthService()
        existing_user = await auth_service.find_user_by_email(email)

        if existing_user:
            from backbone.utils.security import PasswordManager

            await existing_user.set(
                {
                    "hashed_password": PasswordManager.hash_password(password),
                    "role": UserRole.ADMIN,
                    "is_active": True,
                    "is_verified": True,
                }
            )
            console.print(f"[green]✔[/green] Admin user [bold]{email}[/bold] updated.")
        else:
            from backbone.domain.models import User
            from backbone.utils.security import PasswordManager

            new_admin = User(
                email=email,
                full_name=full_name,
                hashed_password=PasswordManager.hash_password(password),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            await new_admin.insert()
            console.print(f"[green]✔[/green] Admin user [bold]{email}[/bold] created.")

    asyncio.run(_run())


# ── change-password ────────────────────────────────────────────────────────


@app.command("change-password")
def change_user_password(
    email: str = typer.Argument(..., help="User email address"),
    new_password: str = typer.Option(
        ..., prompt="New password", confirmation_prompt=True, hide_input=True
    ),
) -> None:
    """Change the password for any user."""

    async def _run() -> None:
        await _bootstrap_database()
        from backbone.services.auth import AuthService
        from backbone.utils.security import PasswordManager

        auth_service = AuthService()
        user = await auth_service.find_user_by_email(email)

        if not user:
            console.print(f"[red]✘[/red] No user found with email: {email}")
            raise typer.Exit(code=1)

        await user.set({"hashed_password": PasswordManager.hash_password(new_password)})
        console.print(f"[green]✔[/green] Password updated for [bold]{email}[/bold].")

    asyncio.run(_run())


# ── list-users ─────────────────────────────────────────────────────────────


@app.command("list-users")
def list_all_users(limit: int = typer.Option(20, help="Max users to display")) -> None:
    """Display a table of registered users."""

    async def _run() -> None:
        await _bootstrap_database()
        from backbone.domain.models import User

        users = await User.find().limit(limit).to_list()
        table = Table(title=f"Users (showing up to {limit})")
        table.add_column("Email", style="cyan")
        table.add_column("Full Name")
        table.add_column("Role", style="magenta")
        table.add_column("Verified", style="green")
        table.add_column("Active", style="yellow")

        for user in users:
            table.add_row(
                user.email,
                user.full_name,
                user.role.value,
                "✔" if user.is_verified else "✘",
                "✔" if user.is_active else "✘",
            )

        console.print(table)

    asyncio.run(_run())


# ── flush-db ───────────────────────────────────────────────────────────────


@app.command("flush-db")
def flush_database(
    confirm: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation prompt"),
) -> None:
    """
    Drop all backbone collections (User, Session, Task, Email, Log, etc.).
    WARNING: This is irreversible. Use only in development.
    """
    if not confirm:
        typer.confirm(
            "⚠️  This will permanently delete all documents in all backbone collections. Continue?",
            abort=True,
        )

    async def _run() -> None:
        await _bootstrap_database()
        from backbone.domain.models import Attachment, Email, LogEntry, Session, Store, Task, User

        collections_to_flush = [User, Session, LogEntry, Attachment, Store, Task, Email]
        for collection in collections_to_flush:
            model_cls = cast(type[Document], collection)
            try:
                await model_cls.delete_all()
                console.print(f"[yellow]✔[/yellow] Flushed: {model_cls.__name__}")
            except Exception as exc:
                console.print(f"[red]✘[/red] Failed to flush {model_cls.__name__}: {exc}")

        console.print("[bold green]Database flushed.[/bold green]")

    asyncio.run(_run())


# ── worker ─────────────────────────────────────────────────────────────────


@app.command("worker")
def start_background_worker(
    concurrency: int = typer.Option(4, help="Number of concurrent task slots"),
) -> None:
    """Start the Backbone Redis task worker."""
    console.print(Panel(f"[bold cyan]Backbone Worker[/bold cyan] — concurrency={concurrency}"))

    async def _run() -> None:
        await _bootstrap_database()
        from backbone.services.tasks import BackboneWorker

        worker = BackboneWorker()
        await worker.start()

    asyncio.run(_run())


# ── run-tests ──────────────────────────────────────────────────────────────


@app.command("run-tests")
def run_test_suite(
    path: str = typer.Argument("tests/", help="Test path to run"),
    verbose: bool = typer.Option(False, "-v", help="Verbose output"),
) -> None:
    """Run the Backbone test suite using pytest."""
    cmd = [sys.executable, "-m", "pytest", path]
    if verbose:
        cmd.append("-v")
    result = subprocess.run(cmd)
    raise typer.Exit(code=result.returncode)


# ── info ───────────────────────────────────────────────────────────────────


@app.command("info")
def show_framework_info() -> None:
    """Display current Backbone configuration."""
    from backbone import __version__
    from backbone.config import settings

    table = Table(title=f"Backbone v{__version__} — Configuration")
    table.add_column("Setting", style="cyan", no_wrap=True)
    table.add_column("Value")

    info_rows = [
        ("APP_NAME", settings.APP_NAME),
        ("ENVIRONMENT", settings.ENVIRONMENT),
        ("APP_URL", settings.APP_URL),
        ("MONGODB_URL", settings.MONGODB_URL),
        ("DATABASE_NAME", settings.DATABASE_NAME),
        ("REDIS_URL", settings.REDIS_URL),
        ("CACHE_ENABLED", str(settings.CACHE_ENABLED)),
        ("EMAIL_ENABLED", str(settings.EMAIL_ENABLED)),
        ("REQUIRE_EMAIL_VERIFICATION", str(settings.REQUIRE_EMAIL_VERIFICATION)),
        ("ADMIN_EMAIL", settings.ADMIN_EMAIL),
        ("ADMIN_PREFIX", settings.ADMIN_PREFIX),
    ]

    for setting_name, setting_value in info_rows:
        table.add_row(setting_name, setting_value)

    console.print(table)


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app()
