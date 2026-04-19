"""
* backbone/core/dependencies.py
? FastAPI dependency functions for authentication / user resolution.
"""

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from backbone.utils.security import TokenManager

logger = logging.getLogger("backbone.core.dependencies")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Resolve the authenticated User from a Bearer JWT.
    Validates token type, session activity, and user status.
    Raises HTTP 401 on any failure.
    """
    from backbone.domain.models import Session, User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = TokenManager.decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    session_id: str | None = payload.get("sid")
    if not user_id or not session_id:
        raise credentials_exception

    active_session = await Session.get(session_id)
    if not active_session or not getattr(active_session, "is_active", False):
        raise credentials_exception

    user = await User.get(user_id, fetch_links=True)
    if not user or not user.is_active:
        raise credentials_exception

    # ? Ensure linked profile image is properly resolved (fetch_links=True can be unreliable)
    try:
        await user.fetch_link("profile_image")
    except Exception:
        logger.debug("Failed to manually fetch profile_image for user %s", user_id)

    return user


async def get_optional_user(token: str = Depends(oauth2_scheme)):
    """
    Resolve the authenticated User if a valid token is present; return None otherwise.
    Useful for public endpoints that enrich the response for logged-in users.
    """
    if not token:
        return None
    try:
        return await get_current_user(token)
    except HTTPException:
        return None
