from typing import List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, conint
from sqlmodel import Session, select
from ..db import get_session
from ..utils.jwt import get_current_user
from ..models.user import User
from ..models.cashier import Cashier
from ..models.member import Member
from ..models.product import Product
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


@router.post("", response_model=Transaction)
def create_transaction(data: TransactionCreateInput, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role not in ("cashier", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    cashier = session.exec(select(Cashier).where(Cashier.employee_id == current_user.uid)).first()
    if not cashier:
        cashier = Cashier(employee_id=current_user.uid)
        session.add(cashier)
        session.commit()

    allowed_methods = {"Cash", "Card", "QR Code"}
    if data.payment_method not in allowed_methods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment method")

    items: List[TransactionItem] = []
    subtotal = Decimal("0.00")

    for it in data.items:
        prod = session.exec(select(Product).where(Product.product_id == it.product_id)).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
        if prod.stock_quantity < it.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for product {prod.name}")
        unit_price = Decimal(str(prod.selling_price))
        discount_amount = Decimal("0.00")
        line_total = (Decimal(it.quantity) * unit_price) - discount_amount
        subtotal += line_total
        items.append(TransactionItem(transaction_id=0, product_id=prod.product_id, quantity=it.quantity, unit_price=unit_price, discount_amount=discount_amount, line_total=line_total))

    membership_discount = Decimal("0.00")
    if data.member_id is not None:
        member = session.exec(select(Member).where(Member.member_id == data.member_id)).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        rate = Decimal(str(member.discount_rate))
        membership_discount = (subtotal * rate) / Decimal("100")

    total_amount = subtotal - membership_discount

    tx = Transaction(
        employee_id=current_user.uid,
        member_id=data.member_id,
        subtotal=subtotal,
        product_discount=Decimal("0.00"),
        membership_discount=membership_discount,
        total_amount=total_amount,
        payment_method=data.payment_method,
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)

    for item in items:
        session.add(TransactionItem(transaction_id=tx.transaction_id, product_id=item.product_id, quantity=item.quantity, unit_price=item.unit_price, discount_amount=item.discount_amount, line_total=item.line_total))
        prod = session.exec(select(Product).where(Product.product_id == item.product_id)).first()
        if prod:
            prod.stock_quantity -= item.quantity
            if prod.stock_quantity < 0:
                raise HTTPException(status_code=500, detail="Stock went negative; rollback")
            session.add(prod)

    session.commit()
    session.refresh(tx)
    return tx


@router.get("", response_model=list[Transaction])
def list_transactions(limit: int = 50, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role not in ("manager", "cashier"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    stmt = select(Transaction).order_by(Transaction.transaction_date.desc()).limit(limit)
    return session.exec(stmt).all()
