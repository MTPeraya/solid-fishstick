from fastapi import APIRouter, Depends, status, HTTPException
from sqlmodel import Session
from typing import List
from ..db import get_session
from ..schemas.product_schema import ProductCreate, ProductRead, ProductUpdate, ProductStockUpdate
from ..handlers import product_handler
from ..utils.jwt import get_current_user
from ..models.user import User


router = APIRouter(prefix="/api/products", tags=["products"])


# Dependency to ensure the user is a manager
def manager_only(current_user: User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: Only managers can perform this action")
    return current_user


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, session: Session = Depends(get_session), _: User = Depends(manager_only)):
    """Create a new product (Manager only)"""
    return product_handler.create_product(data, session)


@router.get("", response_model=List[ProductRead])
def list_products(session: Session = Depends(get_session), _: User = Depends(manager_only)):
    """List all products in the catalog (Manager only)"""
    return product_handler.list_products(session)


@router.get("/{product_id}", response_model=ProductRead)
def read_product(product_id: int, session: Session = Depends(get_session), _: User = Depends(manager_only)):
    """Read a single product by ID (Manager only)"""
    return product_handler.read_product(product_id, session)


@router.put("/{product_id}", response_model=ProductRead)
def update_product(product_id: int, data: ProductUpdate, session: Session = Depends(get_session), _: User = Depends(manager_only)):
    """Update product details (excluding stock) (Manager only)"""
    return product_handler.update_product(product_id, data, session)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, session: Session = Depends(get_session), _: User = Depends(manager_only)):
    """Delete a product from the catalog (Manager only)"""
    return product_handler.delete_product(product_id, session)


@router.patch("/{product_id}/stock", response_model=ProductRead)
def update_stock(product_id: int, data: ProductStockUpdate, session: Session = Depends(get_session), _: User = Depends(manager_only)):
    """Update stock quantity of a product (Inventory Management) (Manager only)"""
    return product_handler.update_product_stock(product_id, data, session)