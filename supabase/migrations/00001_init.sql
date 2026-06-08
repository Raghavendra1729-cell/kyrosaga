CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    inventory_count INTEGER NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL,
    ai_description TEXT,
    extracted_attributes JSONB,
    embedding_coordinates VECTOR(1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_embedding_idx ON products USING hnsw (embedding_coordinates vector_cosine_ops);

CREATE INDEX IF NOT EXISTS products_title_idx ON products (title);

CREATE INDEX IF NOT EXISTS products_inventory_count_idx ON products (inventory_count);

CREATE INDEX IF NOT EXISTS products_attributes_idx ON products USING gin (extracted_attributes);
