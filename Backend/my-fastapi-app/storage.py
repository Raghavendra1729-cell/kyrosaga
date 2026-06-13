import os
from typing import Protocol, runtime_checkable
from config import settings

@runtime_checkable
class StorageDriver(Protocol):
    async def upload_file(self, file_bytes: bytes, filename: str, directory_prefix: str) -> str:
        ...
    async def generate_presigned_upload_url(self, file_key: str, mime_type: str, expiration_seconds: int) -> str:
        ...
    async def get_public_url(self, file_key: str) -> str:
        ...
    async def delete_file(self, file_key: str) -> None:
        ...

class LocalStorageDriver:
    async def upload_file(self, file_bytes: bytes, filename: str, directory_prefix: str) -> str:
        os.makedirs(settings.local_storage_path, exist_ok=True)
        file_path = os.path.join(settings.local_storage_path, filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        return f"{settings.local_asset_serve_url}{filename}"

    async def generate_presigned_upload_url(self, file_key: str, mime_type: str, expiration_seconds: int) -> str:
        raise NotImplementedError("Pre-signed URLs are not supported in local storage mode")

    async def get_public_url(self, file_key: str) -> str:
        return f"{settings.local_asset_serve_url}{file_key}"

    async def delete_file(self, file_key: str) -> None:
        # file_key might be the full URL or just a filename/path relative to local_storage_path
        prefix = settings.local_asset_serve_url
        if file_key.startswith(prefix):
            file_key = file_key[len(prefix):]
            
        # Prevent absolute-path joins and path traversal outside local_storage_path
        base_path = os.path.abspath(settings.local_storage_path)
        rel_path = os.path.normpath(file_key).lstrip(os.sep)
        file_path = os.path.abspath(os.path.join(base_path, rel_path))
        
        if not file_path.startswith(base_path + os.sep):
            raise ValueError("Invalid file path")
            
        if os.path.exists(file_path):
            os.remove(file_path)

class R2StorageDriver:
    async def upload_file(self, file_bytes: bytes, filename: str, directory_prefix: str) -> str:
        import boto3
        from botocore.config import Config
        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4")
        )
        key = f"{directory_prefix}{filename}"
        s3.put_object(
            Bucket=settings.r2_bucket_name,
            Key=key,
            Body=file_bytes,
            ContentType="image/webp"
        )
        return f"{settings.r2_public_url}/{key}"

    async def generate_presigned_upload_url(self, file_key: str, mime_type: str, expiration_seconds: int) -> str:
        import boto3
        from botocore.config import Config
        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4")
        )
        return s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.r2_bucket_name,
                "Key": file_key,
                "ContentType": mime_type
            },
            ExpiresIn=expiration_seconds
        )

    async def get_public_url(self, file_key: str) -> str:
        return f"{settings.r2_public_url}/{file_key}"

    async def delete_file(self, file_key: str) -> None:
        import boto3
        from botocore.config import Config
        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4")
        )
        prefix = f"{settings.r2_public_url}/"
        if file_key.startswith(prefix):
            file_key = file_key[len(prefix):]
            
        s3.delete_object(
            Bucket=settings.r2_bucket_name,
            Key=file_key
        )

def get_storage_driver() -> StorageDriver:
    if settings.storage_driver == "r2":
        return R2StorageDriver()
    return LocalStorageDriver()
