from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from pydantic import BaseModel, condecimal
from decimal import Decimal
from typing import List
from datetime import date
from ..db import get_session
from ..models.promotion import Promotion
from ..models.product import Product
from ..utils.jwt import get_current_user
from ..models.user import User

router = APIRouter(prefix="/api/promotions", tags=["promotions"])

# --- Schemas ---

class PromotionCreate(BaseModel):
    promotion_name: str
    discount_type: str
    # Ensures discount_value is >= 0.01 and has up to 2 decimal places
    discount_value: condecimal(ge=Decimal("0.01"), decimal_places=2) 
    start_date: date
    end_date: date
    is_active: bool = True

class PromotionUpdate(BaseModel):
    promotion_name: str | None = None
    discount_type: str | None = None
    discount_value: condecimal(ge=Decimal("0.01"), decimal_places=2) | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None

# --- CRUD Endpoints ---

@router.post("", response_model=Promotion, status_code=status.HTTP_201_CREATED)
def create_promotion(data: PromotionCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Create a new promotion (Manager only)."""
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    # Validation based on CheckConstraints in the model:
    if data.discount_type not in ('PERCENTAGE', 'FIXED'):
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount type must be 'PERCENTAGE' or 'FIXED'")
    if data.discount_type == 'PERCENTAGE' and data.discount_value > Decimal('100.00'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Percentage discount cannot exceed 100.00")
    if data.end_date < data.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be after start date")

    promo = Promotion.model_validate(data)
    session.add(promo)
    session.commit()
    session.refresh(promo)
    return promo

@router.get("", response_model=List[Promotion])
def list_promotions(active_only: bool = Query(default=False), session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """List promotions. Managers see all; cashiers may request active-only."""
    if current_user.role not in ("manager", "cashier"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    stmt = select(Promotion)
    if active_only:
        today = date.today()
        stmt = stmt.where(
            Promotion.is_active == True,
            Promotion.start_date <= today,
            Promotion.end_date >= today,
        )
    return session.exec(stmt).all()

@router.patch("/{promotion_id}", response_model=Promotion)
def update_promotion(promotion_id: int, data: PromotionUpdate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Update an existing promotion (Manager only)."""
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    promo = session.exec(select(Promotion).where(Promotion.promotion_id == promotion_id)).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    update_data = data.model_dump(exclude_unset=True)
    
    # Re-validate complex rules involving multiple fields before update
    if 'discount_type' in update_data and update_data['discount_type'] not in ('PERCENTAGE', 'FIXED'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount type must be 'PERCENTAGE' or 'FIXED'")
    
    current_type = update_data.get('discount_type', promo.discount_type)
    current_value = update_data.get('discount_value', promo.discount_value)

    if current_type == 'PERCENTAGE' and current_value is not None and current_value > Decimal('100.00'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Percentage discount cannot exceed 100.00")

    current_start = update_data.get('start_date', promo.start_date)
    current_end = update_data.get('end_date', promo.end_date)
    
    if current_end is not None and current_start is not None and current_end < current_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be after start date")

    for field, value in update_data.items():
        setattr(promo, field, value)

    session.add(promo)
    session.commit()
    session.refresh(promo)
    return promo

@router.delete("/{promotion_id}")
def delete_promotion(promotion_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Delete a promotion and unlink it from products (Manager only)."""
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        
    promo = session.exec(select(Promotion).where(Promotion.promotion_id == promotion_id)).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
        
    # Before deleting, unlink it from any products
    products_to_unlink = session.exec(select(Product).where(Product.promotion_id == promotion_id)).all()
    for product in products_to_unlink:
        product.promotion_id = None
        session.add(product)
        
    session.delete(promo)
    session.commit()
    return {"ok": True}
