import uuid
import json
from typing import Any
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END
from image_compression import compress_image
from parser import parse_product_image
from embeddings import generate_product_embedding
from storage import get_storage_driver
from db import Database

class ProductIngestionState(BaseModel):
    raw_image: bytes
    title: str
    price: float
    inventory_count: int
    optimized_image_bytes: bytes | None = None
    optimized_image_url: str | None = None
    colour: str | None = None
    style: str | None = None
    material_type: str | None = None
    shape: str | None = None
    ai_description: str | None = None
    embedding_coordinates: list[float] | None = None
    status: str = "started"
    error: str | None = None

async def compress_node(state: ProductIngestionState) -> dict[str, Any]:
    try:
        compressed = compress_image(state.raw_image)
        filename = f"{uuid.uuid4()}.webp"
        driver = get_storage_driver()
        url = await driver.upload_file(compressed, filename, "permanent_catalog/")
        return {
            "optimized_image_bytes": compressed,
            "optimized_image_url": url,
            "status": "compressed"
        }
    except Exception as e:
        return {"error": f"Compression node failed: {str(e)}", "status": "failed"}

async def parse_node(state: ProductIngestionState) -> dict[str, Any]:
    if state.error:
        return {}
    if not state.optimized_image_bytes:
        return {"error": "Missing optimized image bytes", "status": "failed"}
    try:
        attributes = await parse_product_image(state.optimized_image_bytes)
        return {
            "colour": attributes.colour,
            "style": attributes.style,
            "material_type": attributes.material_type,
            "shape": attributes.shape,
            "ai_description": attributes.description,
            "status": "parsed"
        }
    except Exception as e:
        return {"error": f"Parsing node failed: {str(e)}", "status": "failed"}

async def embed_node(state: ProductIngestionState) -> dict[str, Any]:
    if state.error:
        return {}
    if not state.optimized_image_bytes:
        return {"error": "Missing optimized image bytes", "status": "failed"}
    text_content = f"{state.title} {state.colour or ''} {state.style or ''} {state.material_type or ''} {state.shape or ''} {state.ai_description or ''}"
    try:
        vector = await generate_product_embedding(text_content, state.optimized_image_bytes)
        return {
            "embedding_coordinates": vector,
            "status": "embedded"
        }
    except Exception as e:
        return {"error": f"Embedding node failed: {str(e)}", "status": "failed"}

async def sync_node(state: ProductIngestionState) -> dict[str, Any]:
    if state.error:
        return {}
    attributes_dict = {
        "colour": state.colour,
        "style": state.style,
        "material_type": state.material_type,
        "shape": state.shape
    }
    attributes_json = json.dumps(attributes_dict)
    vector_str = None
    if state.embedding_coordinates:
        vector_str = f"[{','.join(str(val) for val in state.embedding_coordinates)}]"

    query = """
        INSERT INTO products (title, price, inventory_count, image_url, ai_description, extracted_attributes, embedding_coordinates)
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
        RETURNING id;
    """
    try:
        row = await Database.fetchrow(
            query,
            state.title,
            state.price,
            state.inventory_count,
            state.optimized_image_url,
            state.ai_description,
            attributes_json,
            vector_str
        )
        if not row:
            raise RuntimeError("Failed to insert product record")
        return {
            "status": "synced"
        }
    except Exception as e:
        return {"error": f"Database sync node failed: {str(e)}", "status": "failed"}

def build_ingestion_graph() -> Any:
    builder = StateGraph(ProductIngestionState)
    builder.add_node("compress", compress_node)
    builder.add_node("parse", parse_node)
    builder.add_node("embed", embed_node)
    builder.add_node("sync", sync_node)

    builder.add_edge(START, "compress")
    builder.add_edge("compress", "parse")
    builder.add_edge("parse", "embed")
    builder.add_edge("embed", "sync")
    builder.add_edge("sync", END)

    return builder.compile()
