import os
import json
from contextlib import asynccontextmanager
import time
import asyncio
from typing import Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from src.config import settings
from src.db import Database
from src.storage import get_storage_driver
from src.graph import build_ingestion_graph, ProductIngestionState
from src.embeddings import generate_product_embedding
from src.image_compression import compress_image
from src.analytics import log_search_event

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

os.makedirs(settings.local_storage_path, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.local_storage_path), name="static")

class StatusResponse(BaseModel):
    message: str
    storage_driver: str
    model_id: str

@app.get("/api/health")
async def read_health() -> dict[str, str]:
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
    start_time = time.time()
    
    if not text_query and not image_query:
        raise HTTPException(status_code=400, detail="At least one query signal (text or image) must be provided")
        
    image_bytes = None
    if image_query:
        raw_image_bytes = await image_query.read()
        if len(raw_image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image size exceeds 10MB limit")
        try:
            image_bytes = compress_image(raw_image_bytes)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
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
        
        # Telemetry logging
        processing_latency_ms = int((time.time() - start_time) * 1000)
        matched_product_ids = [res["id"] for res in results]
        similarity_scores = [res["similarity"] for res in results]
        result_count = len(results)
        is_zero_result = result_count == 0
        
        # We don't want telemetry errors to break search
        asyncio.create_task(log_search_event(
            session_id=None, # To be added later if needed
            query_text=text_query,
            has_image_query=image_bytes is not None,
            matched_product_ids=matched_product_ids,
            similarity_scores=similarity_scores,
            applied_threshold=min_similarity,
            processing_latency_ms=processing_latency_ms,
            result_count=result_count,
            is_zero_result=is_zero_result
        ))
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database execution failed: {str(e)}")

@app.get("/api/products")
async def list_products(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
) -> list[dict[str, Any]]:
    query = """
        SELECT id, title, price, inventory_count, image_url, ai_description, extracted_attributes 
        FROM products 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
    """
    try:
        records = await Database.fetch(query, limit, offset)
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

@app.put("/api/products/{product_id}")
async def update_product(
    product_id: str,
    title: str | None = Form(None),
    price: float | None = Form(None),
    inventory_count: int | None = Form(None),
    file: UploadFile | None = File(None)
) -> dict[str, Any]:
    # Check if product exists
    query_check = "SELECT * FROM products WHERE id = $1"
    existing = await Database.fetchrow(query_check, product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    # If new image is uploaded, we run the ingestion pipeline logic
    if file:
        file_bytes = await file.read()
        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # We reuse the graph for the ingestion part, but we need to update the DB manually 
        # since graph.sync_node does an INSERT. We can just skip sync_node or do the steps manually.
        # It's cleaner to do the steps manually here to avoid duplicating graph state logic.
        from src.image_compression import compress_image
        import uuid
        from src.parser import parse_product_image
        
        # 1. Compress
        compressed = compress_image(file_bytes)
        filename = f"{uuid.uuid4()}.webp"
        driver = get_storage_driver()
        url = await driver.upload_file(compressed, filename, "permanent_catalog/")
        
        # 2. Parse
        attributes = await parse_product_image(compressed)
        
        # 3. Embed
        final_title = title if title is not None else existing["title"]
        text_content = f"{final_title} {attributes.colour or ''} {attributes.style or ''} {attributes.material_type or ''} {attributes.shape or ''} {attributes.description or ''}"
        vector = await generate_product_embedding(text_content, compressed)
        vector_str = f"[{','.join(str(val) for val in vector)}]"
        
        # 4. Update DB with new image and embeddings
        attributes_dict = {
            "colour": attributes.colour,
            "style": attributes.style,
            "material_type": attributes.material_type,
            "shape": attributes.shape
        }
        
        update_query = """
            UPDATE products 
            SET title = COALESCE($1, title), 
                price = COALESCE($2, price), 
                inventory_count = COALESCE($3, inventory_count),
                image_url = $4,
                ai_description = $5,
                extracted_attributes = $6,
                embedding_coordinates = $7::vector,
                updated_at = NOW()
            WHERE id = $8
        """
        await Database.execute(
            update_query,
            title, price, inventory_count,
            url, attributes.description, json.dumps(attributes_dict), vector_str,
            product_id
        )
        
        # Optionally delete old image
        try:
            old_url = existing["image_url"]
            await driver.delete_file(old_url)
        except Exception:
            pass

    else:
        # Just update text fields
        update_query = """
            UPDATE products 
            SET title = COALESCE($1, title), 
                price = COALESCE($2, price), 
                inventory_count = COALESCE($3, inventory_count),
                updated_at = NOW()
            WHERE id = $4
        """
        await Database.execute(update_query, title, price, inventory_count, product_id)

    return {"status": "success", "message": "Product updated successfully"}

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str) -> dict[str, Any]:
    query_check = "SELECT image_url FROM products WHERE id = $1"
    existing = await Database.fetchrow(query_check, product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    # Delete from DB
    delete_query = "DELETE FROM products WHERE id = $1"
    await Database.execute(delete_query, product_id)

    # Delete image from storage
    try:
        driver = get_storage_driver()
        await driver.delete_file(existing["image_url"])
    except Exception as e:
        import logging
        logging.warning(f"Failed to delete image for product {product_id}: {e}")

    return {"status": "success", "message": "Product deleted successfully"}

@app.get("/api/analytics/summary")
async def get_analytics_summary() -> dict[str, Any]:
    query = """
        SELECT 
            COUNT(*) as total_searches,
            SUM(CASE WHEN is_zero_result THEN 1 ELSE 0 END) as zero_result_searches,
            AVG(processing_latency_ms) as avg_latency_ms
        FROM search_telemetry
    """
    try:
        row = await Database.fetchrow(query)
        if not row:
            return {"total_searches": 0, "zero_result_rate": 0.0, "avg_latency_ms": 0.0}
            
        total_searches = row["total_searches"] or 0
        zero_result_searches = row["zero_result_searches"] or 0
        avg_latency_ms = float(row["avg_latency_ms"]) if row["avg_latency_ms"] is not None else 0.0
        
        zero_result_rate = (zero_result_searches / total_searches) if total_searches > 0 else 0.0
        
        return {
            "total_searches": total_searches,
            "zero_result_rate": round(zero_result_rate, 4),
            "avg_latency_ms": round(avg_latency_ms, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

frontend_dist_path = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")

