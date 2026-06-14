import argparse
import random
import io
import httpx
import asyncio
from PIL import Image

API_BASE_URL = "http://127.0.0.1:8000"

COLORS = [
    ("Red", (255, 0, 0)),
    ("Blue", (0, 0, 255)),
    ("Green", (0, 255, 0)),
    ("Yellow", (255, 255, 0)),
    ("Purple", (128, 0, 128)),
    ("Orange", (255, 165, 0)),
    ("Cyan", (0, 255, 255)),
    ("Magenta", (255, 0, 255)),
    ("Gray", (128, 128, 128)),
    ("Black", (0, 0, 0))
]

ITEMS = [
    "Chair", "Table", "Lamp", "Sofa", "Rug", 
    "Vase", "Bookshelf", "Desk", "Bed", "Mirror"
]

def generate_image(color_rgb):
    img = Image.new('RGB', (400, 400), color=color_rgb)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

async def upload_product(client, i):
    color_name, color_rgb = random.choice(COLORS)
    item_name = random.choice(ITEMS)
    title = f"{color_name} {item_name} {i}"
    price = round(random.uniform(10.0, 500.0), 2)
    inventory = random.randint(0, 100)
    
    print(f"Uploading {title}...")
    
    img_bytes = generate_image(color_rgb)
    
    files = {
        'file': (f'product_{i}.png', img_bytes, 'image/png')
    }
    data = {
        'title': title,
        'price': str(price),
        'inventory_count': str(inventory)
    }
    
    try:
        # Increase timeout because parsing and embedding can take a few seconds per item
        response = await client.post(f"{API_BASE_URL}/api/products/upload", data=data, files=files, timeout=60.0)
        response.raise_for_status()
        print(f"✅ Successfully uploaded {title}")
    except Exception as e:
        print(f"❌ Failed to upload {title}: {e}")

async def seed_products(count):
    print(f"Starting to seed {count} products...")
    # We upload sequentially to avoid overwhelming the local API and Gemini rate limits
    async with httpx.AsyncClient() as client:
        for i in range(count):
            await upload_product(client, i)
            # Add a small delay between uploads to be safe with rate limits
            await asyncio.sleep(1)
    print("Seeding complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the database with sample products.")
    parser.add_argument("--count", type=int, default=10, help="Number of products to generate and upload.")
    args = parser.parse_args()
    
    asyncio.run(seed_products(args.count))
