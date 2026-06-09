import pytest
import io
from PIL import Image
from fastapi.testclient import TestClient
import os
import sys

# Add the parent directory to sys.path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

@pytest.fixture
def client():
    # In a real test suite, you'd override dependencies here to prevent real DB calls.
    # For now, we return a TestClient.
    return TestClient(app)

@pytest.fixture
def sample_image_bytes():
    # Create a simple 10x10 red image in memory for testing
    img = Image.new('RGB', (10, 10), color=(255, 0, 0))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

@pytest.fixture
def mock_gemini(mocker):
    # This mocks the genai client to avoid real API calls during tests
    mock_client = mocker.patch('google.genai.Client')
    # Mock embed_content
    mock_embed_response = mocker.MagicMock()
    mock_embed_response.embeddings = [mocker.MagicMock(values=[0.1] * 1024)]
    
    # We need to mock the async aio model methods
    async def mock_embed_content(*args, **kwargs):
        return mock_embed_response
        
    mock_client.return_value.aio.models.embed_content = mock_embed_content
    
    # Mock generate_content
    mock_generate_response = mocker.MagicMock()
    mock_generate_response.text = '{"colour": "red", "style": "modern", "material_type": "fabric", "shape": "square", "description": "A red square"}'
    
    async def mock_generate_content(*args, **kwargs):
        return mock_generate_response
        
    mock_client.return_value.aio.models.generate_content = mock_generate_content
    
    return mock_client

@pytest.fixture
def mock_db(mocker):
    # Mock database calls
    mock_execute = mocker.patch('db.Database.execute', new_callable=mocker.AsyncMock)
    mock_fetchrow = mocker.patch('db.Database.fetchrow', new_callable=mocker.AsyncMock)
    mock_fetch = mocker.patch('db.Database.fetch', new_callable=mocker.AsyncMock)
    
    return {
        'execute': mock_execute,
        'fetchrow': mock_fetchrow,
        'fetch': mock_fetch
    }
