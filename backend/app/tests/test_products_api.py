from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
import app.db as db
from app.main import app


def setup_module(module):
    db.engine = create_engine("sqlite:///test_products.db", echo=False, connect_args={"check_same_thread": False})
    SQLModel.metadata.drop_all(db.engine)
    SQLModel.metadata.create_all(db.engine)


client = TestClient(app)


def signin(email: str, password: str):
    r = client.post("/api/users/signin", json={"identifier": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def signup_manager(email: str, username: str, name: str, password: str):
    payload = {"email": email, "password": password, "username": username, "name": name, "role": "manager", "manager_secret": "ef276129"}
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 200


def test_products_crud_and_search():
    signup_manager("m1@example.com", "m1", "M1", "secret12")
    token = signin("m1@example.com", "secret12")

    p = {
        "barcode": "1234567890123",
        "name": "Item A",
        "brand": "BrandX",
        "category": "Cat",
        "cost_price": "50.00",
        "selling_price": "70.00",
        "stock_quantity": 10,
        "min_stock": 2,
    }
    r1 = client.post("/api/products", json=p, headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 200
    prod = r1.json()
    pid = prod["product_id"]

    rdup = client.post("/api/products", json=p, headers={"Authorization": f"Bearer {token}"})
    assert rdup.status_code == 400

    rup = client.patch(f"/api/products/{pid}", json={"name": "Item A+", "selling_price": "75.00"}, headers={"Authorization": f"Bearer {token}"})
    assert rup.status_code == 200
    assert rup.json()["name"] == "Item A+"
    assert str(rup.json()["selling_price"]) in {"75.00", "75"}

    rq = client.get("/api/products", params={"q": "Item"})
    assert rq.status_code == 200
    assert any(x["product_id"] == pid for x in rq.json())

    rbc = client.get("/api/products", params={"barcode": "1234567890123"})
    assert rbc.status_code == 200
    assert len(rbc.json()) == 1
    assert rbc.json()[0]["product_id"] == pid

    rd = client.delete(f"/api/products/{pid}", headers={"Authorization": f"Bearer {token}"})
    assert rd.status_code == 200
    rnf = client.delete(f"/api/products/{pid}", headers={"Authorization": f"Bearer {token}"})
    assert rnf.status_code == 404
