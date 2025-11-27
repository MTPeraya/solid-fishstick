from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_list_items_empty():
    r = client.get("/api/items")
    assert r.status_code == 200
    assert r.json() == []


def test_create_item():
    r = client.post("/api/items", json={"name": "A"})
    assert r.status_code == 200
    assert r.json()["name"] == "A"
