from decimal import Decimal
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import CheckConstraint
from sqlalchemy.types import Numeric


class TransactionItem(SQLModel, table=True):
    transaction_id: int = Field(foreign_key="transaction.transaction_id", primary_key=True)
    product_id: int = Field(foreign_key="product.product_id", primary_key=True)
    quantity: int
    unit_price: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    discount_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(10, 2)))
    line_total: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    __table_args__ = (
        CheckConstraint("quantity > 0"),
        CheckConstraint("unit_price >= 0"),
        CheckConstraint("discount_amount >= 0"),
        CheckConstraint("line_total >= 0"),
        CheckConstraint("line_total = (quantity * unit_price) - discount_amount"),
    )

