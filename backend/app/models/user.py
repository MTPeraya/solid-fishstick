from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone
from uuid import uuid4


class User(SQLModel, table=True):
    uid: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    email: str = Field(index=True, sa_column_kwargs={"unique": True})
    username: str = Field(sa_column_kwargs={"unique": True})
    name: str
    hashed_password: str
    role: str = Field(default="cashier")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
