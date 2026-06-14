import pytest
from src.parser import parse_product_image

@pytest.mark.asyncio
async def test_parse_product_image_success(sample_image_bytes, mock_gemini):
    attributes = await parse_product_image(sample_image_bytes)
    assert attributes is not None
    assert attributes.colour == "red"
    assert attributes.style == "modern"
    assert attributes.material_type == "fabric"
    assert attributes.shape == "square"
    assert attributes.description == "A red square"
