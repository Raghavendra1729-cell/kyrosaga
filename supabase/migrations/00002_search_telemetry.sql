CREATE TABLE IF NOT EXISTS search_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    query_text TEXT,
    has_image_query BOOLEAN NOT NULL,
    matched_product_ids UUID[],
    similarity_scores NUMERIC(5, 4)[],
    applied_threshold NUMERIC(4, 3) NOT NULL,
    processing_latency_ms INT NOT NULL,
    result_count INT NOT NULL DEFAULT 0,
    is_zero_result BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS search_telemetry_created_at_idx ON search_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS search_telemetry_has_image_query_idx ON search_telemetry(has_image_query);
CREATE INDEX IF NOT EXISTS search_telemetry_is_zero_result_idx ON search_telemetry(is_zero_result);
