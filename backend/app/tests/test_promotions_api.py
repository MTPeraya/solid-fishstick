from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
import app.db as db
from app.main import app
from datetime import date, timedelta
from decimal import Decimal


def setup_module(module):
    db.engine = create_engine("sqlite:///test_promotions.db", echo=False, connect_args={"check_same_thread": False})
    SQLModel.metadata.drop_all(db.engine)
    SQLModel.metadata.create_all(db.engine)


client = TestClient(app)


def signup_manager(email: str, username: str, name: str, password: str):
    payload = {"email": email, "password": password, "username": username, "name": name, "role": "manager", "manager_secret": "ef276129"}
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 200


def signup_cashier(email: str, username: str, name: str, password: str):
    payload = {"email": email, "password": password, "username": username, "name": name, "role": "cashier"}
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 200


def signin(email: str, password: str):
    r = client.post("/api/users/signin", json={"identifier": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_promotions_crud_and_filtering():
    today = date.today()
    tomorrow = today + timedelta(days=1)

    signup_manager("pmgr@example.com", "pmgr", "PromoMgr", "secret12")
    mtoken = signin("pmgr@example.com", "secret12")

    # Create percentage promotion
    p1 = {
        "promotion_name": "TenPercent",
        "discount_type": "PERCENTAGE",
        "discount_value": "10.00",
        "start_date": str(today),
        "end_date": str(tomorrow),
        "is_active": True,
    }
    r1 = client.post("/api/promotions", json=p1, headers={"Authorization": f"Bearer {mtoken}"})
    assert r1.status_code == 201
    promo1 = r1.json()

    # Create fixed promotion
    p2 = {
        "promotion_name": "FiveBaht",
        "discount_type": "FIXED",
        "discount_value": "5.00",
        "start_date": str(today),
        "end_date": str(tomorrow),
        "is_active": True,
    }
    r2 = client.post("/api/promotions", json=p2, headers={"Authorization": f"Bearer {mtoken}"})
    assert r2.status_code == 201
    promo2 = r2.json()

    # List as manager (should include both)
    rl_all = client.get("/api/promotions", headers={"Authorization": f"Bearer {mtoken}"})
    assert rl_all.status_code == 200
    ids = {x["promotion_id"] for x in rl_all.json()}
    assert promo1["promotion_id"] in ids and promo2["promotion_id"] in ids

    # Cashier active_only
    signup_cashier("pcash@example.com", "pcash", "PromoCash", "secret12")
    ctoken = signin("pcash@example.com", "secret12")
    rl_active = client.get("/api/promotions", params={"active_only": True}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rl_active.status_code == 200
    assert all(x["is_active"] for x in rl_active.json())

    # Update invalid percentage (>100)
    rup_bad = client.patch(f"/api/promotions/{promo1['promotion_id']}", json={"discount_type": "PERCENTAGE", "discount_value": "150.00"}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rup_bad.status_code == 400

    # Update invalid date range
    rup_bad2 = client.patch(f"/api/promotions/{promo1['promotion_id']}", json={"start_date": str(tomorrow), "end_date": str(today)}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rup_bad2.status_code == 400

    # Deactivate second promo and check active_only filtering
    rup2 = client.patch(f"/api/promotions/{promo2['promotion_id']}", json={"is_active": False}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rup2.status_code == 200
    rl_active2 = client.get("/api/promotions", params={"active_only": True}, headers={"Authorization": f"Bearer {ctoken}"})
    assert rl_active2.status_code == 200
    ids_active = {x["promotion_id"] for x in rl_active2.json()}
    assert promo1["promotion_id"] in ids_active and promo2["promotion_id"] not in ids_active

    # Create a product and assign promo2, then delete promo2 should unlink
    prod_payload = {
        "barcode": "9876543210000",
        "name": "PromoProd",
        "brand": "B",
        "category": "C",
        "cost_price": "30.00",
        "selling_price": "50.00",
        "stock_quantity": 5,
        "min_stock": 2,
    }
    rp = client.post("/api/products", json=prod_payload, headers={"Authorization": f"Bearer {mtoken}"})
    assert rp.status_code == 200
    pid = rp.json()["product_id"]

    # Assign promo2
    rassign = client.patch(f"/api/products/{pid}", json={"promotion_id": promo2["promotion_id"]}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rassign.status_code == 200
    assert rassign.json().get("promotion_id") == promo2["promotion_id"]

    # Delete promo2
    rdel = client.delete(f"/api/promotions/{promo2['promotion_id']}", headers={"Authorization": f"Bearer {mtoken}"})
    assert rdel.status_code == 200

    # Fetch product again, should be unlinked
    rq = client.get("/api/products", params={"barcode": prod_payload["barcode"]})
    assert rq.status_code == 200
    prod = rq.json()[0]
    assert prod.get("promotion_id") is None


def test_transaction_applies_promotion_discounts():
    today = date.today()
    tomorrow = today + timedelta(days=1)

    signup_manager("mgr2@example.com", "mgr2", "Manager2", "secret12")
    mtoken = signin("mgr2@example.com", "secret12")
    signup_cashier("cash2@example.com", "cash2", "Cashier2", "secret12")
    ctoken = signin("cash2@example.com", "secret12")

    # Product
    prod_payload = {
        "barcode": "1234500000000",
        "name": "PDiscount",
        "brand": "B",
        "category": "C",
        "cost_price": "80.00",
        "selling_price": "100.00",
        "stock_quantity": 10,
        "min_stock": 1,
    }
    rp = client.post("/api/products", json=prod_payload, headers={"Authorization": f"Bearer {mtoken}"})
    assert rp.status_code == 200
    pid = rp.json()["product_id"]

    # Percentage promo 20%
    promo_payload = {
        "promotion_name": "TwentyPercent",
        "discount_type": "PERCENTAGE",
        "discount_value": "20.00",
        "start_date": str(today),
        "end_date": str(tomorrow),
        "is_active": True,
    }
    rpr = client.post("/api/promotions", json=promo_payload, headers={"Authorization": f"Bearer {mtoken}"})
    assert rpr.status_code == 201
    promo_id = rpr.json()["promotion_id"]

    # Assign to product
    rassign = client.patch(f"/api/products/{pid}", json={"promotion_id": promo_id}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rassign.status_code == 200

    # Checkout Qty=2, price 100, discount 20% => 40.00 total product discount
    payload = {"items": [{"product_id": pid, "quantity": 2}], "payment_method": "Cash"}
    rtx = client.post("/api/transactions", json=payload, headers={"Authorization": f"Bearer {ctoken}"})
    assert rtx.status_code == 200
    tx = rtx.json()
    assert Decimal(str(tx["product_discount"])) == Decimal("40.00")
    assert Decimal(str(tx["membership_discount"])) == Decimal("0.00")
    assert Decimal(str(tx["subtotal"])) == Decimal("160.00")
    assert Decimal(str(tx["total_amount"])) == Decimal("160.00")

    # Fixed promo 5.00 per unit on another product
    prod2 = {
        "barcode": "1234500000001",
        "name": "FDiscount",
        "brand": "B",
        "category": "C",
        "cost_price": "40.00",
        "selling_price": "50.00",
        "stock_quantity": 10,
        "min_stock": 1,
    }
    rp2 = client.post("/api/products", json=prod2, headers={"Authorization": f"Bearer {mtoken}"})
    assert rp2.status_code == 200
    pid2 = rp2.json()["product_id"]

    fixed_promo = {
        "promotion_name": "FixedFive",
        "discount_type": "FIXED",
        "discount_value": "5.00",
        "start_date": str(today),
        "end_date": str(tomorrow),
        "is_active": True,
    }
    rfp = client.post("/api/promotions", json=fixed_promo, headers={"Authorization": f"Bearer {mtoken}"})
    assert rfp.status_code == 201
    fid = rfp.json()["promotion_id"]

    rassign2 = client.patch(f"/api/products/{pid2}", json={"promotion_id": fid}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rassign2.status_code == 200

    payload2 = {"items": [{"product_id": pid2, "quantity": 3}], "payment_method": "Cash"}
    rtx2 = client.post("/api/transactions", json=payload2, headers={"Authorization": f"Bearer {ctoken}"})
    assert rtx2.status_code == 200
    tx2 = rtx2.json()
    # 3 * 5.00 = 15.00 discount
    assert Decimal(str(tx2["product_discount"])) == Decimal("15.00")
    assert Decimal(str(tx2["membership_discount"])) == Decimal("0.00")
    assert Decimal(str(tx2["subtotal"])) == Decimal("135.00")
    assert Decimal(str(tx2["total_amount"])) == Decimal("135.00")
