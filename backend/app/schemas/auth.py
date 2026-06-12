from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional


class RegisterEmailRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone: Optional[str] = None

    @validator("phone")
    def validate_phone(cls, v: str) -> Optional[str]:
        if v is None:
            return v
        s = v.strip()
        if not s.isdigit() or len(s) != 10:
            raise ValueError("Phone must be 10 digits (Indian mobile number)")
        return s


class RegisterOTPRequest(BaseModel):
    name: str = Field(..., min_length=1)
    phone: str

    @validator("phone")
    def validate_indian_phone(cls, v: str) -> str:
        s = v.strip()
        if not s.isdigit() or len(s) != 10:
            raise ValueError("Phone must be 10 digits (Indian mobile number)")
        return s


class RegisterEmailOtpSendRequest(BaseModel):
    email: EmailStr


class RegisterEmailOtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

    @validator("otp")
    def otp_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

    @validator("otp")
    def otp_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=8)

    @validator("otp")
    def reset_otp_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class LoginEmailRequest(BaseModel):
    email: EmailStr
    password: str


class OTPSendRequest(BaseModel):
    phone: str

    @validator("phone")
    def validate_phone(cls, v: str) -> str:
        s = v.strip()
        if not s.isdigit() or len(s) != 10:
            raise ValueError("Phone must be 10 digits")
        return s


class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str

    @validator("otp")
    def otp_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400


class UserOut(BaseModel):
    id: int
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_verified: bool
    auth_method: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminOTPVerifyRequest(BaseModel):
    email: str
    otp: str

    @validator("otp")
    def otp_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class AdminForgotPasswordRequest(BaseModel):
    email: EmailStr


class AdminResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=8)

    @validator("otp")
    def otp_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class SessionOut(BaseModel):
    id:          int
    device_info: Optional[str] = None
    ip_address:  Optional[str] = None
    created_at:  datetime
    last_used:   datetime
    is_current:  bool = False

    class Config:
        from_attributes = True


# Ensure Pydantic models are fully built
try:
    RegisterEmailRequest.model_rebuild()
    RegisterOTPRequest.model_rebuild()
    RegisterEmailOtpSendRequest.model_rebuild()
    RegisterEmailOtpVerifyRequest.model_rebuild()
    ForgotPasswordRequest.model_rebuild()
    ForgotPasswordVerifyRequest.model_rebuild()
    ResetPasswordRequest.model_rebuild()
    LoginEmailRequest.model_rebuild()
    OTPSendRequest.model_rebuild()
    OTPVerifyRequest.model_rebuild()
    TokenResponse.model_rebuild()
    UserOut.model_rebuild()
    AdminLoginRequest.model_rebuild()
    AdminTokenResponse.model_rebuild()
    AdminOTPVerifyRequest.model_rebuild()
    AdminForgotPasswordRequest.model_rebuild()
    AdminResetPasswordRequest.model_rebuild()
    SessionOut.model_rebuild()
except Exception:
    pass