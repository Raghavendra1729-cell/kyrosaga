import os
import json
from contextlib import asynccontextmanager
from typing import Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from config import settings
from db import Database
from graph import build_ingestion_graph, ProductIngestionState
from embeddings import generate_product_embedding

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.local_storage_path, exist_ok=True)
    await Database.connect()
    yield
    await Database.disconnect()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=settings.local_storage_path), name="static")

class StatusResponse(BaseModel):
    message: str
    storage_driver: str
    model_id: str

@app.get("/")
async def read_root() -> dict[str, str]:
    return {
        "message": "Kyrosaga Backend API is online for Bish",
        "storage_driver": settings.storage_driver,
        "model_id": settings.gemini_flash_model_id
    }

@app.post("/api/products/upload")
async def upload_product(
    file: UploadFile = File(...),
    title: str = Form(...),
    price: float = Form(...),
    inventory_count: int = Form(...)
) -> dict[str, Any]:
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    initial_state = ProductIngestionState(
        raw_image=file_bytes,
        title=title,
        price=price,
        inventory_count=inventory_count
    )
    
    graph = build_ingestion_graph()
    result = await graph.ainvoke(initial_state)
    
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])
        
    return {
        "status": "success",
        "image_url": result.get("optimized_image_url"),
        "colour": result.get("colour"),
        "style": result.get("style"),
        "material_type": result.get("material_type"),
        "shape": result.get("shape"),
        "ai_description": result.get("ai_description")
    }

@app.post("/api/products/search")
async def search_products(
    text_query: str | None = Form(None),
    image_query: UploadFile | None = File(None),
    min_inventory: int | None = Form(None),
    colour: str | None = Form(None),
    style: str | None = Form(None),
    material_type: str | None = Form(None),
    shape: str | None = Form(None)
) -> list[dict[str, Any]]:
    if not text_query and not image_query:
        raise HTTPException(status_code=400, detail="At least one query signal (text or image) must be provided")
        
    image_bytes = None
    if image_query:
        image_bytes = await image_query.read()
        
    text_payload = text_query or ""
    
    try:
        vector = await generate_product_embedding(text_payload, image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding model execution failed: {str(e)}")
        
    vector_str = f"[{','.join(str(val) for val in vector)}]"
    
    query_parts = [
        "SELECT id, title, price, inventory_count, image_url, ai_description, extracted_attributes,",
        "1 - (embedding_coordinates <=> $1::vector) AS similarity",
        "FROM products",
        "WHERE embedding_coordinates IS NOT NULL"
    ]
    
    params: list[Any] = [vector_str]
    param_counter = 2
    
    if min_inventory is not None:
        query_parts.append(f"AND inventory_count >= ${param_counter}")
        params.append(min_inventory)
        param_counter += 1
        
    if colour:
        query_parts.append(f"AND extracted_attributes->>'colour' ILIKE ${param_counter}")
        params.append(f"%{colour}%")
        param_counter += 1
        
    if style:
        query_parts.append(f"AND extracted_attributes->>'style' ILIKE ${param_counter}")
        params.append(f"%{style}%")
        param_counter += 1
        
    if material_type:
        query_parts.append(f"AND extracted_attributes->>'material_type' ILIKE ${param_counter}")
        params.append(f"%{material_type}%")
        param_counter += 1
        
    if shape:
        query_parts.append(f"AND extracted_attributes->>'shape' ILIKE ${param_counter}")
        params.append(f"%{shape}%")
        param_counter += 1
        
    query_parts.append(f"ORDER BY embedding_coordinates <=> $1::vector ASC LIMIT 10")
    
    full_query = " ".join(query_parts)
    
    try:
        records = await Database.fetch(full_query, *params)
        results = []
        min_similarity = 0.60 if image_bytes is not None else 0.48
        for row in records:
            similarity = float(row["similarity"])
            if similarity >= min_similarity:
                results.append({
                    "id": str(row["id"]),
                    "title": row["title"],
                    "price": float(row["price"]),
                    "inventory_count": row["inventory_count"],
                    "image_url": row["image_url"],
                    "ai_description": row["ai_description"],
                    "extracted_attributes": json.loads(row["extracted_attributes"]) if isinstance(row["extracted_attributes"], str) else row["extracted_attributes"],
                    "similarity": similarity
                })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database execution failed: {str(e)}")

@app.get("/api/products")
async def list_products() -> list[dict[str, Any]]:
    query = "SELECT id, title, price, inventory_count, image_url, ai_description, extracted_attributes FROM products ORDER BY created_at DESC"
    try:
        records = await Database.fetch(query)
        results = []
        for row in records:
            results.append({
                "id": str(row["id"]),
                "title": row["title"],
                "price": float(row["price"]),
                "inventory_count": row["inventory_count"],
                "image_url": row["image_url"],
                "ai_description": row["ai_description"],
                "extracted_attributes": json.loads(row["extracted_attributes"]) if isinstance(row["extracted_attributes"], str) else row["extracted_attributes"]
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/products/{product_id}")
async def get_product(product_id: str) -> dict[str, Any]:
    query = "SELECT id, title, price, inventory_count, image_url, ai_description, extracted_attributes FROM products WHERE id = $1"
    try:
        row = await Database.fetchrow(query, product_id)
        if not row:
            raise HTTPException(status_code=404, detail="Product not found")
        return {
            "id": str(row["id"]),
            "title": row["title"],
            "price": float(row["price"]),
            "inventory_count": row["inventory_count"],
            "image_url": row["image_url"],
            "ai_description": row["ai_description"],
            "extracted_attributes": json.loads(row["extracted_attributes"]) if isinstance(row["extracted_attributes"], str) else row["extracted_attributes"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
