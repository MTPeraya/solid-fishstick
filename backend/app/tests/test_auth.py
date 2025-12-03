from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
import app.db as db
from app.main import app


def setup_module(module):
    # Use file-based SQLite for tests; allow cross-thread access
    db.engine = create_engine("sqlite:///test_auth.db", echo=False, connect_args={"check_same_thread": False})
    SQLModel.metadata.drop_all(db.engine)
    SQLModel.metadata.create_all(db.engine)


client = TestClient(app)


def test_signup_cashier_success():
    payload = {
        "email": "cashier@example.com",
        "password": "secret12",
        "username": "cashier1",
        "name": "Cashier One",
        "role": "cashier",
    }
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == payload["email"]
    assert data["username"] == payload["username"]
    assert data["role"] == "cashier"


def test_signup_manager_requires_secret():
    payload = {
        "email": "manager@example.com",
        "password": "secret12",
        "username": "manager1",
        "name": "Manager One",
        "role": "manager",
    }
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 403


def test_signup_manager_with_secret_succeeds():
    payload = {
        "email": "manager2@example.com",
        "password": "secret12",
        "username": "manager2",
        "name": "Manager Two",
        "role": "manager",
        "manager_secret": "ef276129",
    }
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 200
    assert r.json()["role"] == "manager"


def test_signup_duplicate_email_fails():
    payload = {
        "email": "dup@example.com",
        "password": "secret12",
        "username": "dupuser1",
        "name": "Dup User",
        "role": "cashier",
    }
    r1 = client.post("/api/users/signup", json=payload)
    assert r1.status_code == 200
    payload["username"] = "dupuser2"  # different username, same email
    r2 = client.post("/api/users/signup", json=payload)
    assert r2.status_code == 400


def test_signup_duplicate_username_fails():
    payload1 = {
        "email": "u1@example.com",
        "password": "secret12",
        "username": "sameuser",
        "name": "User One",
        "role": "cashier",
    }
    payload2 = {
        "email": "u2@example.com",
        "password": "secret12",
        "username": "sameuser",
        "name": "User Two",
        "role": "cashier",
    }
    r1 = client.post("/api/users/signup", json=payload1)
    assert r1.status_code == 200
    r2 = client.post("/api/users/signup", json=payload2)
    assert r2.status_code == 400


def test_signin_and_me_flow():
    # Create user
    payload = {
        "email": "signin@example.com",
        "password": "secret12",
        "username": "signinuser",
        "name": "Sign In User",
        "role": "cashier",
    }
    rs = client.post("/api/users/signup", json=payload)
    assert rs.status_code == 200
    # Sign in
    ri = client.post("/api/users/signin", json={"identifier": payload["email"], "password": payload["password"]})
    assert ri.status_code == 200
    token = ri.json()["access_token"]
    assert token
    # Me
    rm = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert rm.status_code == 200
    me = rm.json()
    assert me["email"] == payload["email"]
    assert me["username"] == payload["username"]

def test_signin_wrong_password_fails():
    payload = {
        "email": "badpw@example.com",
        "password": "secret12",
        "username": "badpwuser",
        "name": "Bad PW User",
        "role": "cashier",
    }
    rs = client.post("/api/users/signup", json=payload)
    assert rs.status_code == 200
    ri = client.post("/api/users/signin", json={"identifier": payload["email"], "password": "wrongpass"})
    assert ri.status_code == 401

def test_signin_unknown_identifier_fails():
    ri = client.post("/api/users/signin", json={"identifier": "nouser@example.com", "password": "anything"})
    assert ri.status_code == 401


def test_signup_invalid_email_fails():
    payload = {
        "email": "invalid-email",
        "password": "secret12",
        "username": "invalidemailuser",
        "name": "Invalid Email",
        "role": "cashier",
    }
    r = client.post("/api/users/signup", json=payload)
    assert r.status_code == 422


def test_list_users_requires_manager():
    # create cashier
    c_payload = {
        "email": "listc@example.com",
        "password": "secret12",
        "username": "listcashier",
        "name": "List Cashier",
        "role": "cashier",
    }
    rc = client.post("/api/users/signup", json=c_payload)
    assert rc.status_code == 200
    # sign in cashier
    rci = client.post("/api/users/signin", json={"identifier": c_payload["email"], "password": c_payload["password"]})
    assert rci.status_code == 200
    cashier_token = rci.json()["access_token"]
    # cashier should be forbidden
    rforbid = client.get("/api/users", headers={"Authorization": f"Bearer {cashier_token}"})
    assert rforbid.status_code == 403

    # create manager
    m_payload = {
        "email": "listm@example.com",
        "password": "secret12",
        "username": "listmanager",
        "name": "List Manager",
        "role": "manager",
        "manager_secret": "ef276129",
    }
    rm = client.post("/api/users/signup", json=m_payload)
    assert rm.status_code == 200
    # sign in manager
    rmi = client.post("/api/users/signin", json={"identifier": m_payload["email"], "password": m_payload["password"]})
    assert rmi.status_code == 200
    manager_token = rmi.json()["access_token"]
    # list users
    rl = client.get("/api/users", headers={"Authorization": f"Bearer {manager_token}"})
    assert rl.status_code == 200
    lst = rl.json()
    assert isinstance(lst, list)
    assert any(u["email"] == c_payload["email"] for u in lst)
    assert any(u["email"] == m_payload["email"] for u in lst)
