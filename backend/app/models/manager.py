from typing import Optional
from sqlmodel import SQLModel, Field


class Manager(SQLModel, table=True):
    admin_id: int = Field(primary_key=True, foreign_key="user.id")

