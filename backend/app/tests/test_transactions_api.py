from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
import app.db as db
from app.main import app
from app.models.membership_tier import MembershipTier
from app.models.member import Member
from decimal import Decimal


def setup_module(module):
    db.engine = create_engine("sqlite:///test_transactions.db", echo=False, connect_args={"check_same_thread": False})
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


def test_transaction_checkout_flow():
    signup("manager@example.com", "manager", "Manager", "manager", "secret12")
    mtoken = signin("manager@example.com", "secret12")
    signup("cashier@example.com", "cashier", "Cashier", "cashier", "secret12")
    ctoken = signin("cashier@example.com", "secret12")

    p1 = {
        "barcode": "1111111111111",
        "name": "Prod1",
        "brand": "B",
        "category": "C",
        "cost_price": "50.00",
        "selling_price": "70.00",
        "stock_quantity": 10,
        "min_stock": 2,
    }
    p2 = {
        "barcode": "2222222222222",
        "name": "Prod2",
        "brand": "B",
        "category": "C",
        "cost_price": "100.00",
        "selling_price": "120.00",
        "stock_quantity": 5,
        "min_stock": 2,
    }
    r1 = client.post("/api/products", json=p1, headers={"Authorization": f"Bearer {mtoken}"})
    r2 = client.post("/api/products", json=p2, headers={"Authorization": f"Bearer {mtoken}"})
    assert r1.status_code == 200 and r2.status_code == 200
    prod1 = r1.json()["product_id"]
    prod2 = r2.json()["product_id"]

    with Session(db.engine) as s:
        t = s.exec(select(MembershipTier).where(MembershipTier.rank_name == "Bronze")).first()
        if not t:
            t = MembershipTier(rank_name="Bronze", min_spent=Decimal("0.00"), max_spent=None, discount_rate=Decimal("3.00"))
            s.add(t)
            s.commit()
        m = Member(name="Member A", phone="0900000000", registration_date=__import__("datetime").date.today())
        s.add(m)
        s.commit()
        s.refresh(m)
        member_id = m.member_id

    payload = {
        "items": [{"product_id": prod1, "quantity": 2}, {"product_id": prod2, "quantity": 1}],
        "member_id": member_id,
        "payment_method": "Cash",
    }
    rtx = client.post("/api/transactions", json=payload, headers={"Authorization": f"Bearer {ctoken}"})
    assert rtx.status_code == 200
    tx = rtx.json()
    subtotal = Decimal("0.00")
    subtotal += Decimal("70.00") * Decimal(2)
    subtotal += Decimal("120.00") * Decimal(1)
    discount = (subtotal * Decimal(str(3.00))) / Decimal("100")
    assert Decimal(str(tx["subtotal"])) == subtotal
    assert Decimal(str(tx["membership_discount"])) == discount
    assert Decimal(str(tx["total_amount"])) == subtotal - discount

    rbad = client.post("/api/transactions", json={"items": [{"product_id": prod2, "quantity": 99}], "payment_method": "Cash"}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rbad.status_code == 400

    rbad2 = client.post("/api/transactions", json={"items": [{"product_id": prod1, "quantity": 1}], "payment_method": "Bitcoin"}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rbad2.status_code == 400
