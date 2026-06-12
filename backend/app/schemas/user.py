from __future__ import annotations

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class AddressCreate(BaseModel):
    label: str = "Home"
    name: str
    phone: str = Field(..., pattern=r"^\d{10}$")
    house_no: str
    area: str
    village: str
    taluka: str
    district: str
    pincode: str = Field(..., pattern=r"^\d{6}$")
    state: str = "Gujarat"
    gstin: Optional[str] = None


class AddressOut(BaseModel):
    id: int
    label: str
    name: str
    phone: str
    house_no: str
    area: str
    village: str
    taluka: str
    district: str
    pincode: str
    state: str
    is_default: bool
    gstin: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r"^\d{10}$")


class UserOut(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_verified: bool
    auth_method: str


# ── Admin-facing schemas ──────────────────────────────────────────────────────

class AdminUserListItem(BaseModel):
    """Compact user row shown in admin user list."""
    id: int
    name: str
    email: Optional[str] = None      # decrypted by route
    phone: Optional[str] = None      # decrypted by route
    auth_method: str
    is_active: bool
    is_blocked: bool
    blocked_reason: Optional[str] = None
    blocked_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    total_orders: int = 0
    return_count: int = 0

    class Config:
        from_attributes = True


class AdminUserDetail(AdminUserListItem):
    """Full user detail including recent orders."""
    orders: list[dict] = []


class BlockUserRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class UnblockUserRequest(BaseModel):
    pass