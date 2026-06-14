from typing import Any
from google import genai
from google.genai import types
from src.config import settings

async def generate_product_embedding(
    text_content: str,
    image_bytes: bytes | None = None
) -> list[float]:
    client = genai.Client(api_key=settings.gemini_api_key)
    contents: list[Any] = [text_content]
    if image_bytes:
        contents.append(
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/webp"
            )
        )
    response = await client.aio.models.embed_content(
        model=settings.gemini_embedding_model_id,
        contents=contents,
        config=types.EmbedContentConfig(
            output_dimensionality=1024
        )
    )
    if not response.embeddings or not response.embeddings[0].values:
        raise ValueError("No embeddings returned")
    embedding = response.embeddings[0].values
    if len(embedding) != 1024:
        raise ValueError(f"Expected 1024 dimensions, got {len(embedding)}")
    return [float(val) for val in embedding]
