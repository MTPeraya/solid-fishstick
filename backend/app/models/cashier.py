from typing import Optional
from sqlmodel import SQLModel, Field


class Cashier(SQLModel, table=True):
    employee_id: int = Field(primary_key=True, foreign_key="user.id")
    position: str

