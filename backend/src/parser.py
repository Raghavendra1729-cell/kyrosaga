from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from src.config import settings

class ProductAttributes(BaseModel):
    colour: str = Field(description="Dominant color and color scheme details")
    style: str = Field(description="Stylistic trends, design era, and profile")
    material_type: str = Field(description="Raw structural material types from visual cues")
    shape: str = Field(description="Physical geometry, profile styling, and outlines")
    description: str = Field(description="Automated customer-facing product description in rich markdown syntax")

async def parse_product_image(image_bytes: bytes) -> ProductAttributes:
    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model=settings.gemini_flash_model_id,
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/webp"
            ),
            "Analyze this product image and extract its properties as required by the schema."
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ProductAttributes,
        ),
    )
    text_val = response.text
    if not text_val:
        raise ValueError("Empty response from parser model")
    return ProductAttributes.model_validate_json(text_val)
