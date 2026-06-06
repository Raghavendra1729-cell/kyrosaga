from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from google import genai
from google.genai.errors import APIError
from config import settings

app = FastAPI()

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)

@app.get("/")
async def read_root() -> dict[str, str]:
    return {
        "message": "Kyrosaga Backend API is online for Bish",
        "storage_driver": settings.storage_driver,
        "model_id": settings.gemini_flash_model_id
    }

@app.post("/generate")
async def generate_text(request: GenerateRequest) -> dict[str, str]:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500,
            detail="Gemini API key is not configured on the server"
        )
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model=settings.gemini_flash_model_id,
            contents=request.prompt,
        )
        return {"response": response.text or ""}
    except APIError as e:
        raise HTTPException(
            status_code=500,
            detail=e.message
        )
