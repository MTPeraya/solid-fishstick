from pydantic import BaseModel, EmailStr, constr
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: constr(min_length=6, max_length=72)
    username: str
    name: str
    role: str
    manager_secret: str | None = None


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
