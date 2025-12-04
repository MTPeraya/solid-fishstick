from typing import Optional
from decimal import Decimal
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import CheckConstraint
from sqlalchemy.types import Numeric


class Transaction(SQLModel, table=True):
    transaction_id: Optional[int] = Field(default=None, primary_key=True)
    transaction_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    employee_id: str = Field(foreign_key="cashier.employee_id")
    member_id: Optional[int] = Field(default=None, foreign_key="member.member_id")
    subtotal: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    product_discount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(10, 2)))
    membership_discount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(10, 2)))
    total_amount: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    payment_method: str
    __table_args__ = (
        CheckConstraint("subtotal >= 0"),
        CheckConstraint("product_discount >= 0"),
        CheckConstraint("membership_discount >= 0"),
        CheckConstraint("total_amount >= 0"),
        CheckConstraint("payment_method IN ('Cash','Card','QR Code')"),
        CheckConstraint("total_amount = subtotal - membership_discount"),
    )
