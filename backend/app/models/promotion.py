from typing import Optional
from decimal import Decimal
from datetime import date
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import CheckConstraint
from sqlalchemy.types import Numeric


class Promotion(SQLModel, table=True):
    promotion_id: Optional[int] = Field(default=None, primary_key=True)
    promotion_name: str
    discount_type: str
    discount_value: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    start_date: date
    end_date: date
    is_active: bool = Field(default=True)
    __table_args__ = (
        CheckConstraint("discount_type IN ('PERCENTAGE','FIXED')"),
        CheckConstraint("discount_value > 0"),
        CheckConstraint("end_date >= start_date"),
    )

