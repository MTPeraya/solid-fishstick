from typing import Optional
from decimal import Decimal
from datetime import date
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import CheckConstraint
from sqlalchemy.types import Numeric


class Member(SQLModel, table=True):
    member_id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    phone: str = Field(index=True, sa_column_kwargs={"unique": True})
    points_balance: int = Field(default=0)
    total_spent: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(10, 2)))
    membership_rank: str = Field(default="Bronze", foreign_key="membershiptier.rank_name")
    discount_rate: Decimal = Field(default=Decimal("3.00"), sa_column=Column(Numeric(5, 2)))
    registration_date: date
    __table_args__ = (
        CheckConstraint("points_balance >= 0"),
        CheckConstraint("total_spent >= 0"),
        CheckConstraint("discount_rate >= 0 AND discount_rate <= 100"),
    )

