from typing import Optional
from decimal import Decimal
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import CheckConstraint
from sqlalchemy.types import Numeric


class Product(SQLModel, table=True):
    product_id: Optional[int] = Field(default=None, primary_key=True)
    barcode: str = Field(index=True, sa_column_kwargs={"unique": True})
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    cost_price: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    selling_price: Decimal = Field(sa_column=Column(Numeric(10, 2)))
    stock_quantity: int = Field(default=0)
    min_stock: int = Field(default=10)
    promotion_id: Optional[int] = Field(default=None, foreign_key="promotion.promotion_id")
    __table_args__ = (
        CheckConstraint("selling_price >= cost_price"),
        CheckConstraint("stock_quantity >= 0"),
        CheckConstraint("min_stock > 0"),
    )

