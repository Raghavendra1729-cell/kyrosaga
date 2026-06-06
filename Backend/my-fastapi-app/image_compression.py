import io
from PIL import Image

MAX_LAYOUT_WIDTH = 1440
WEBP_QUALITY = 80
MAX_FILE_SIZE = 10 * 1024 * 1024

def compress_image(image_bytes: bytes) -> bytes:
    if not image_bytes:
        raise ValueError("Empty image bytes")
    if len(image_bytes) > MAX_FILE_SIZE:
        raise ValueError("Image file size exceeds 10MB limit")
    
    in_buffer = io.BytesIO(image_bytes)
    with Image.open(in_buffer) as img:
        img_format = img.format
        if img_format not in ["JPEG", "PNG", "WEBP"]:
            img = img.convert("RGB")
        
        width, height = img.size
        if width > MAX_LAYOUT_WIDTH:
            ratio = MAX_LAYOUT_WIDTH / float(width)
            new_height = int(float(height) * ratio)
            img = img.resize((MAX_LAYOUT_WIDTH, new_height), Image.Resampling.LANCZOS)
        
        out_buffer = io.BytesIO()
        img.save(out_buffer, format="WEBP", quality=WEBP_QUALITY)
        return out_buffer.getvalue()
