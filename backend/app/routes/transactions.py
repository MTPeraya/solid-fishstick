from typing import List
from decimal import Decimal, ROUND_HALF_UP 
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, conint
from sqlmodel import Session, select
from datetime import date 
from ..db import get_session
from ..utils.jwt import get_current_user
from ..models.user import User
from ..models.cashier import Cashier
from ..models.member import Member
from ..models.product import Product
from ..models.promotion import Promotion 
from ..models.membership_tier import MembershipTier 
from ..models.transaction import Transaction
from ..models.transaction_item import TransactionItem


router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionItemInput(BaseModel):
    product_id: int
    quantity: conint(gt=0)


class TransactionCreateInput(BaseModel):
    items: List[TransactionItemInput]
    member_id: int | None = None
    payment_method: str

def calculate_product_discount(unit_price: Decimal, quantity: int, promotion: Promotion | None) -> Decimal:
    """Calculates discount for a single line item based on an active promotion."""
    if not promotion:
        return Decimal("0.00")
        
    # Check if promotion is active by date
    today = date.today()
    if not promotion.is_active or today < promotion.start_date or today > promotion.end_date:
        return Decimal("0.00")

    original_line_total = unit_price * Decimal(quantity)

    if promotion.discount_type == 'PERCENTAGE':
        # discount_amount = original_line_total * (discount_value / 100)
        discount = original_line_total * (promotion.discount_value / Decimal("100"))
        # Round the discount amount to 2 decimal places using ROUND_HALF_UP (common in retail)
        return discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    elif promotion.discount_type == 'FIXED':
        # discount_amount = fixed_amount * quantity
        discount = promotion.discount_value * Decimal(quantity)
        return discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    return Decimal("0.00") 

def update_member_tier(member: Member, session: Session):
    """Checks the member's total_spent and updates their tier and discount_rate if necessary."""
    current_spent = member.total_spent
    
    # Find the new rank based on total_spent (highest tier whose min_spent is met)
    stmt = select(MembershipTier).where(MembershipTier.min_spent <= current_spent).order_by(MembershipTier.min_spent.desc())
    new_tier = session.exec(stmt).first()
    
    # Apply changes only if a qualifying tier is found and it's different from the current one
    if new_tier and new_tier.rank_name != member.membership_rank:
        member.membership_rank = new_tier.rank_name
        member.discount_rate = new_tier.discount_rate
        session.add(member)


@router.post("", response_model=Transaction)
def create_transaction(data: TransactionCreateInput, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """Create a transaction with product and membership discounts, and update stock."""
    if current_user.role not in ("cashier", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    allowed_methods = {"Cash", "Card", "QR Code"}
    if data.payment_method not in allowed_methods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment method")

    items_to_save: List[TransactionItem] = []
    subtotal_after_product_discount = Decimal("0.00") 
    total_product_discount = Decimal("0.00") 
    member: Member | None = None
    
    # 1. Product Processing, Discount Calculation, and Stock Check
    for it in data.items:
        prod = session.exec(select(Product).where(Product.product_id == it.product_id)).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
        if prod.stock_quantity < it.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for product {prod.name}. Available: {prod.stock_quantity}, Requested: {it.quantity}")

        # Get the active promotion
        promo: Promotion | None = None
        if prod.promotion_id is not None:
            promo = session.exec(select(Promotion).where(Promotion.promotion_id == prod.promotion_id)).first()
        
        unit_price = prod.selling_price 
        
        # Calculate product discount
        discount_amount = calculate_product_discount(unit_price, it.quantity, promo)
        
        line_total = (Decimal(it.quantity) * unit_price) - discount_amount
        
        # Aggregate totals
        subtotal_after_product_discount += line_total 
        total_product_discount += discount_amount
        
        # Store item data for batch insert
        items_to_save.append(TransactionItem(
            transaction_id=0, # Placeholder
            product_id=prod.product_id, 
            quantity=it.quantity, 
            unit_price=unit_price, 
            discount_amount=discount_amount, 
            line_total=line_total
        ))

    # 2. Membership Discount Calculation
    membership_discount = Decimal("0.00")
    if data.member_id is not None:
        member = session.exec(select(Member).where(Member.member_id == data.member_id)).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        rate = member.discount_rate 
        
        # Membership discount is applied to the subtotal (after product discount)
        membership_discount = (subtotal_after_product_discount * rate) / Decimal("100")
        membership_discount = membership_discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 3. Final Total Calculation
    total_amount = subtotal_after_product_discount - membership_discount
    
    # Create Transaction Record
    tx = Transaction(
        employee_id=current_user.uid,
        member_id=data.member_id,
        subtotal=subtotal_after_product_discount, 
        product_discount=total_product_discount, 
        membership_discount=membership_discount,
        total_amount=total_amount,
        payment_method=data.payment_method,
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)

    # 4. Update Inventory and Save Transaction Items
    for item in items_to_save:
        item.transaction_id = tx.transaction_id
        session.add(item)
        
        prod = session.exec(select(Product).where(Product.product_id == item.product_id)).first()
        if prod:
            prod.stock_quantity -= item.quantity
            session.add(prod)
    
    # 5. Update Member Records (Points, Spending, and Tier Progression)
    if member is not None:
        points_earned = int(total_amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        member.points_balance += points_earned
        member.total_spent += total_amount 
        
        update_member_tier(member, session)

    session.commit() 
    session.refresh(tx)
    return tx


@router.get("", response_model=list[Transaction])
def list_transactions(limit: int = 50, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """List recent transactions (manager and cashier)."""
    if current_user.role not in ("manager", "cashier"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    stmt = select(Transaction).order_by(Transaction.transaction_date.desc()).limit(limit)
    return session.exec(stmt).all()
