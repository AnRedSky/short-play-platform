from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.schemas.identity import UserRead

__all__ = [
    "BootstrapRequest",
    "LoginRequest",
    "LogoutRequest",
    "MeRead",
    "RefreshRequest",
    "TokenPairRead",
    "UserRead",
]


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=16, max_length=256)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=16, max_length=256)


class BootstrapRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)
    full_name: str = Field(min_length=1, max_length=200)
    organization_name: str = Field(min_length=1, max_length=200)


class TokenPairRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str


class MeRead(BaseModel):
    user: UserRead
    organization_id: UUID | None
    permissions: list[str]
