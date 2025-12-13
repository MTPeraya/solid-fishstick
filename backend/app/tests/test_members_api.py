from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
import app.db as db
from app.main import app
from app.models.membership_tier import MembershipTier
from app.models.member import Member
from app.models.transaction import Transaction
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from app.models.user import User


def setup_module(module):
    db.engine = create_engine("sqlite:///test_members.db", echo=False, connect_args={"check_same_thread": False})
    SQLModel.metadata.drop_all(db.engine)
    SQLModel.metadata.create_all(db.engine)


client = TestClient(app)


def signup(email: str, username: str, name: str, role: str, password: str):
    payload = {"email": email, "password": password, "username": username, "name": name, "role": role}
    if role == "manager":
        payload["manager_secret"] = "ef276129"
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 200


def signin(email: str, password: str):
    r = client.post("/api/users/signin", json={"identifier": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_members_list_rolling_spend_and_create():
    signup("manager@example.com", "manager", "Manager", "manager", "secret12")
    mtoken = signin("manager@example.com", "secret12")
    signup("cashier@example.com", "cashier", "Cashier", "cashier", "secret12")
    ctoken = signin("cashier@example.com", "secret12")

    with Session(db.engine) as s:
        tiers = [
            ("Bronze", Decimal("0.00"), Decimal("4999.99"), Decimal("3.00")),
            ("Silver", Decimal("5000.00"), Decimal("19999.99"), Decimal("5.00")),
            ("Gold", Decimal("20000.00"), Decimal("59999.99"), Decimal("8.00")),
            ("Platinum", Decimal("60000.00"), None, Decimal("12.00")),
        ]
        for name, mi, ma, rate in tiers:
            if not s.exec(select(MembershipTier).where(MembershipTier.rank_name == name)).first():
                t = MembershipTier(rank_name=name, min_spent=mi, max_spent=ma, discount_rate=rate)
                s.add(t)
        s.commit()

    rcreate = client.post("/api/members", json={"name": "Member One", "phone": "0811111111"}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rcreate.status_code == 201
    m1 = rcreate.json()
    rcreate2 = client.post("/api/members", json={"name": "Member Two", "phone": "0822222222"}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rcreate2.status_code == 201
    m2 = rcreate2.json()

    with Session(db.engine) as s:
        now = datetime.now(timezone.utc)
        old = now - timedelta(days=400)
        t1 = Transaction(transaction_date=now, employee_id=s.exec(select(User).where(User.username == "cashier")).first().uid, member_id=m1["member_id"], subtotal=Decimal("500.00"), product_discount=Decimal("0.00"), membership_discount=Decimal("0.00"), total_amount=Decimal("500.00"), payment_method="Cash")
        t2 = Transaction(transaction_date=old, employee_id=s.exec(select(User).where(User.username == "cashier")).first().uid, member_id=m1["member_id"], subtotal=Decimal("1000.00"), product_discount=Decimal("0.00"), membership_discount=Decimal("0.00"), total_amount=Decimal("1000.00"), payment_method="Cash")
        t3 = Transaction(transaction_date=now, employee_id=s.exec(select(User).where(User.username == "cashier")).first().uid, member_id=m2["member_id"], subtotal=Decimal("7000.00"), product_discount=Decimal("0.00"), membership_discount=Decimal("0.00"), total_amount=Decimal("7000.00"), payment_method="Cash")
        s.add(t1); s.add(t2); s.add(t3)
        s.commit()

    rlist_cashier = client.get("/api/members", headers={"Authorization": f"Bearer {ctoken}"})
    assert rlist_cashier.status_code == 403

    rlist = client.get("/api/members", headers={"Authorization": f"Bearer {mtoken}"})
    assert rlist.status_code == 200
    items = rlist.json()
    d = {x["phone"]: x for x in items}
    assert Decimal(str(d["0811111111"]["rolling_year_spent"])) == Decimal("500.00")
    assert Decimal(str(d["0822222222"]["rolling_year_spent"])) == Decimal("7000.00")
    assert d["0811111111"]["current_tier"] == "Bronze"
    assert d["0822222222"]["current_tier"] == "Silver"

    # Duplicate phone should fail
    rdup = client.post("/api/members", json={"name": "Member One Dup", "phone": "0811111111"}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rdup.status_code == 400

    # Invalid phone should fail (not digits or wrong length)
    rbad_phone = client.post("/api/members", json={"name": "Bad Phone", "phone": "08ABC"}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rbad_phone.status_code == 400
