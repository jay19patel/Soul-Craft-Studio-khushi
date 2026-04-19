"""
* backbone/schemas/auth.py
? Pydantic schemas for the authentication API surface.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterSchema(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)


class LoginSchema(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginSchema(BaseModel):
    """Authorization ``code`` from Google Identity Services (auth-code / popup flow)."""

    code: str = Field(min_length=10, max_length=4096)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """Public user representation returned by the API."""

    id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    is_google_account: bool = False
    profile_image: str | None = None
    headline: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PasswordChangeSchema(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class PasswordResetRequestSchema(BaseModel):
    email: EmailStr


class PasswordResetConfirmSchema(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
    confirm_password: str

    def passwords_match(self) -> bool:
        return self.new_password == self.confirm_password
