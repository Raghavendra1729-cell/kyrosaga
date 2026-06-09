import pytest
from main import app
from fastapi.testclient import TestClient

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Kyrosaga Backend API is online" in response.json()["message"]

def test_list_products_empty(client, mock_db):
    mock_db["fetch"].return_value = []
    response = client.get("/api/products")
    assert response.status_code == 200
    assert response.json() == []

def test_list_products(client, mock_db):
    mock_db["fetch"].return_value = [
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "title": "Test Chair",
            "price": 99.99,
            "inventory_count": 10,
            "image_url": "http://example.com/test.webp",
            "ai_description": "A test chair",
            "extracted_attributes": '{"colour": "red", "style": "modern"}'
        }
    ]
    response = client.get("/api/products")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Test Chair"

def test_search_products_missing_query(client):
    response = client.post("/api/products/search")
    assert response.status_code == 400

def test_get_product_not_found(client, mock_db):
    mock_db["fetchrow"].return_value = None
    response = client.get("/api/products/nonexistent")
    assert response.status_code == 404

def test_delete_product(client, mock_db):
    mock_db["fetchrow"].return_value = {"image_url": "test.webp"}
    response = client.delete("/api/products/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 200
    assert response.json() == {"status": "success", "message": "Product deleted successfully"}
