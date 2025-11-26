from typing import Optional
from decimal import Decimal
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import CheckConstraint
from sqlalchemy.types import Numeric


class MembershipTier(SQLModel, table=True):
    rank_name: str = Field(primary_key=True)
    min_spent: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    max_spent: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 2)))
    discount_rate: Decimal = Field(sa_column=Column(Numeric(5, 2)))
    benefits: Optional[str] = None
    __table_args__ = (
        CheckConstraint("min_spent >= 0"),
        CheckConstraint("(max_spent IS NULL) OR (max_spent > min_spent)"),
        CheckConstraint("discount_rate >= 0 AND discount_rate <= 100"),
    )

