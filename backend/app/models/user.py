from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, sa_column_kwargs={"unique": True})
    username: Optional[str] = Field(default=None, sa_column_kwargs={"unique": True})
    name: Optional[str] = None
    uid: Optional[str] = Field(default=None, sa_column_kwargs={"unique": True})
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
