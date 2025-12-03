from pydantic import BaseModel, EmailStr, constr, field_validator
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: constr(min_length=6, max_length=72)
    username: str
    name: str
    role: str
    manager_secret: str | None = None

    @field_validator('email', mode='before')
    def normalize_email(cls, v):
        if isinstance(v, str):
            s = v.strip()
            parts = s.split('@')
            if len(parts) == 2:
                s = parts[0] + '@' + parts[1].lower()
            return s
        return v


class UserLogin(BaseModel):
    identifier: str
    password: str


class UserRead(BaseModel):
    uid: str
    email: EmailStr
    username: str
    name: str
    role: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
