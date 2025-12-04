from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from pydantic import BaseModel
from decimal import Decimal
from sqlalchemy import or_
from ..db import get_session
from ..models.product import Product
from ..utils.jwt import get_current_user
from ..models.user import User


router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[Product])
def list_products(q: str | None = Query(default=None), barcode: str | None = Query(default=None), session: Session = Depends(get_session)):
    if barcode:
        prod = session.exec(select(Product).where(Product.barcode == barcode)).first()
        if not prod:
            raise HTTPException(status_code=404, detail="Product not found")
        return [prod]
    if q:
        pattern = f"%{q}%"
        stmt = select(Product).where(
            or_(
                Product.name.ilike(pattern),
                Product.brand.ilike(pattern),
                Product.category.ilike(pattern),
                Product.barcode.ilike(pattern),
            )
        ).limit(50)
        return session.exec(stmt).all()
    return session.exec(select(Product).limit(50)).all()


class ProductCreate(BaseModel):
    barcode: str
    name: str
    brand: str | None = None
    category: str | None = None
    cost_price: Decimal
    selling_price: Decimal
    stock_quantity: int = 0
    min_stock: int = 10


@router.post("", response_model=Product)
def create_product(data: ProductCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    existing = session.exec(select(Product).where(Product.barcode == data.barcode)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Barcode already exists")
    p = Product(
        barcode=data.barcode,
        name=data.name,
        brand=data.brand,
        category=data.category,
        cost_price=data.cost_price,
        selling_price=data.selling_price,
        stock_quantity=data.stock_quantity,
        min_stock=data.min_stock,
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


class ProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    selling_price: Decimal | None = None
    stock_quantity: int | None = None
    min_stock: int | None = None


@router.patch("/{product_id}", response_model=Product)
def update_product(product_id: int, data: ProductUpdate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    p = session.exec(select(Product).where(Product.product_id == product_id)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@router.delete("/{product_id}")
def delete_product(product_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    p = session.exec(select(Product).where(Product.product_id == product_id)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    session.delete(p)
    session.commit()
    return {"ok": True}
