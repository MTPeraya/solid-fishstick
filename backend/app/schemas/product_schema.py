from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal


class ProductBase(BaseModel):
    barcode: str
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    cost_price: Decimal = Field(..., ge=Decimal("0.00"))
    selling_price: Decimal = Field(..., ge=Decimal("0.00"))


class ProductCreate(ProductBase):
    stock_quantity: int = Field(0, ge=0)
    min_stock: int = Field(10, ge=1)
    promotion_id: Optional[int] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    cost_price: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    selling_price: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    min_stock: Optional[int] = Field(None, ge=1)
    promotion_id: Optional[int] = None # Set to null to remove promotion


class ProductRead(ProductBase):
    product_id: int
    stock_quantity: int
    min_stock: int
    promotion_id: Optional[int]
    
    class Config:
        from_attributes = True


class ProductStockUpdate(BaseModel):
    stock_quantity: int = Field(..., ge=0)