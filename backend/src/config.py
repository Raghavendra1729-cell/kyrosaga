from pydantic_settings import BaseSettings
from pydantic import Field, model_validator
from typing import Self

class Settings(BaseSettings):
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    database_url: str = Field(default="", alias="DATABASE_URL")
    storage_driver: str = Field(default="local", alias="STORAGE_DRIVER")
    
    r2_account_id: str | None = Field(default=None, alias="R2_ACCOUNT_ID")
    r2_access_key_id: str | None = Field(default=None, alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str | None = Field(default=None, alias="R2_SECRET_ACCESS_KEY")
    r2_bucket_name: str | None = Field(default=None, alias="R2_BUCKET_NAME")
    r2_public_url: str | None = Field(default=None, alias="R2_PUBLIC_URL")
    
    posthog_api_key: str | None = Field(default=None, alias="POSTHOG_API_KEY")
    posthog_host: str = Field(default="https://us.i.posthog.com", alias="POSTHOG_HOST")
    
    local_storage_path: str = "./local_storage"
    local_asset_serve_url: str = "http://localhost:8000/static/"
    
    gemini_flash_model_id: str = "gemini-3-flash-preview"
    gemini_embedding_model_id: str = "gemini-embedding-2"

    @model_validator(mode="after")
    def validate_r2_credentials(self) -> Self:
        if self.storage_driver == "r2":
            if not self.r2_account_id:
                raise ValueError("R2_ACCOUNT_ID is required when STORAGE_DRIVER is r2")
            if not self.r2_access_key_id:
                raise ValueError("R2_ACCESS_KEY_ID is required when STORAGE_DRIVER is r2")
            if not self.r2_secret_access_key:
                raise ValueError("R2_SECRET_ACCESS_KEY is required when STORAGE_DRIVER is r2")
            if not self.r2_bucket_name:
                raise ValueError("R2_BUCKET_NAME is required when STORAGE_DRIVER is r2")
            if not self.r2_public_url:
                raise ValueError("R2_PUBLIC_URL is required when STORAGE_DRIVER is r2")
        return self

    class Config:
        env_file = "../../.env"
        extra = "ignore"
        populate_by_name = True

settings = Settings()
