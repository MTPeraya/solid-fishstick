from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from pydantic import BaseModel
from decimal import Decimal
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import func
from ..db import get_session
from ..utils.jwt import get_current_user
from ..models.user import User
from ..models.member import Member
from ..models.transaction import Transaction
from ..models.membership_tier import MembershipTier

router = APIRouter(prefix="/api/members", tags=["members"])


class MemberCreate(BaseModel):
    name: str
    phone: str


class MemberSummary(BaseModel):
    member_id: int
    name: str
    phone: str
    points_balance: int
    membership_rank: str
    discount_rate: Decimal
    registration_date: date
    rolling_year_spent: Decimal
    current_tier: str
    current_discount_rate: Decimal


@router.post("", response_model=Member, status_code=status.HTTP_201_CREATED)
def create_member(data: MemberCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role not in ("manager", "cashier"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    name = (data.name or "").strip()
    phone = (data.phone or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name too short")
    if not phone.isdigit() or len(phone) != 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid phone")
    exists = session.exec(select(Member).where(Member.phone == phone)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone already registered")
    m = Member(name=name, phone=phone, registration_date=date.today())
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


@router.get("", response_model=list[MemberSummary])
def list_members(q: str | None = Query(default=None), session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    stmt = select(Member)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where((Member.name.ilike(pattern)) | (Member.phone.ilike(pattern)))
    members = session.exec(stmt).all()
    threshold = datetime.now(timezone.utc) - timedelta(days=365)
    agg_stmt = select(Transaction.member_id, func.coalesce(func.sum(Transaction.total_amount), 0)).where(Transaction.transaction_date >= threshold).group_by(Transaction.member_id)
    agg_rows = session.exec(agg_stmt).all()
    spent_map: dict[int, Decimal] = {}
    for mid, s in agg_rows:
        spent_map[int(mid)] = Decimal(str(s))
    tiers = session.exec(select(MembershipTier)).all()
    tiers_sorted = sorted(tiers, key=lambda t: t.min_spent)
    out: list[MemberSummary] = []
    for m in members:
        rs = spent_map.get(m.member_id or 0, Decimal("0.00"))
        current = None
        for t in tiers_sorted:
            if rs >= t.min_spent and (t.max_spent is None or rs <= t.max_spent):
                current = t
        if current is None and tiers_sorted:
            current = tiers_sorted[0]
        out.append(MemberSummary(
            member_id=m.member_id or 0,
            name=m.name,
            phone=m.phone,
            points_balance=m.points_balance,
            membership_rank=m.membership_rank,
            discount_rate=m.discount_rate,
            registration_date=m.registration_date,
            rolling_year_spent=rs.quantize(Decimal("0.01")),
            current_tier=current.rank_name if current else m.membership_rank,
            current_discount_rate=current.discount_rate if current else m.discount_rate,
        ))
    return out
