from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
import app.db as db
from app.main import app


def setup_module(module):
    db.engine = create_engine("sqlite:///test_users_employees.db", echo=False, connect_args={"check_same_thread": False})
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


def test_employees_list_and_filtering():
    signup("manager1@example.com", "manager1", "Manager 1", "manager", "secret12")
    signup("manager2@example.com", "manager2", "Manager 2", "manager", "secret12")
    signup("cashier1@example.com", "cashier1", "Cashier 1", "cashier", "secret12")
    signup("cashier2@example.com", "cashier2", "Cashier 2", "cashier", "secret12")

    mtoken = signin("manager1@example.com", "secret12")
    ctoken = signin("cashier1@example.com", "secret12")

    rforbid = client.get("/api/users/employees", headers={"Authorization": f"Bearer {ctoken}"})
    assert rforbid.status_code != 200

    rall = client.get("/api/users/employees", headers={"Authorization": f"Bearer {mtoken}"})
    assert rall.status_code == 200
    lst = rall.json()
    assert any(u["email"] == "manager1@example.com" for u in lst)
    assert any(u["email"] == "cashier1@example.com" for u in lst)
    assert lst[0]["role"] == "manager"

    rman = client.get("/api/users/employees", params={"role": "manager"}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rman.status_code == 200
    assert all(u["role"] == "manager" for u in rman.json())

    rcash = client.get("/api/users/employees", params={"role": "cashier"}, headers={"Authorization": f"Bearer {mtoken}"})
    assert rcash.status_code == 200
    assert all(u["role"] == "cashier" for u in rcash.json())
