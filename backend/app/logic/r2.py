import boto3
from botocore.client import Config
from app.core.config import settings

def get_r2_client():
    """
    Initializes and returns a boto3 client configured for Cloudflare R2.
    Returns None if R2 credentials are not fully configured.
    """
    if not is_r2_configured():
        return None
    try:
        return boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=5,
                retries={"max_attempts": 1}
            ),
        )
    except Exception as e:
        print(f"[ERROR] Failed to initialize R2 client: {str(e)}")
        return None

def is_r2_configured() -> bool:
    """
    Returns True if R2 credentials and bucket configurations are fully specified and not placeholders.
    """
    if not all([
        settings.R2_ACCESS_KEY_ID,
        settings.R2_SECRET_ACCESS_KEY,
        settings.R2_ENDPOINT_URL,
        settings.R2_BUCKET_NAME
    ]):
        return False

    # Guard against dummy / placeholder values from setup docs or examples
    endpoint_lower = str(settings.R2_ENDPOINT_URL).lower()
    key_lower = str(settings.R2_ACCESS_KEY_ID).lower()
    placeholders = ["pending", "your-account-id", "example", "placeholder"]
    if any(ph in endpoint_lower or ph in key_lower for ph in placeholders):
        return False

    return True

def upload_image_to_r2(image_data: bytes, filename: str, content_type: str = "image/jpeg") -> str:
    """
    Uploads raw image bytes to the Cloudflare R2 bucket.
    Returns the public URL of the uploaded image if successful, otherwise None.
    """
    client = get_r2_client()
    if not client or not settings.R2_BUCKET_NAME:
        print("[WARNING] R2 client not initialized or R2_BUCKET_NAME is missing. Cannot upload.")
        return None
    
    try:
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=filename,
            Body=image_data,
            ContentType=content_type
        )
        
        # Construct public URL
        # e.g., https://static.crediiflow.in or https://pub-xxx.r2.dev
        if settings.R2_PUBLIC_URL:
            public_base = settings.R2_PUBLIC_URL.rstrip("/")
            return f"{public_base}/{filename}"
        else:
            public_base = settings.R2_ENDPOINT_URL.rstrip("/")
            return f"{public_base}/{settings.R2_BUCKET_NAME}/{filename}"
            
    except Exception as e:
        print(f"[ERROR] Failed to upload image to Cloudflare R2: {str(e)}")
        return None

def delete_image_from_r2(file_url: str) -> bool:
    """
    Deletes an image from Cloudflare R2 bucket given its public URL.
    """
    client = get_r2_client()
    if not client or not settings.R2_BUCKET_NAME or not file_url:
        return False
    
    try:
        # Extract filename (key) from URL (the last part after '/')
        filename = file_url.split("/")[-1]
        if not filename:
            return False
            
        client.delete_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=filename
        )
        print(f"[INFO] Successfully deleted image from R2: {filename}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to delete image from Cloudflare R2: {str(e)}")
        return False
