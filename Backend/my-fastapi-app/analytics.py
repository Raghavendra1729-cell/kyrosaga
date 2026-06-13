import asyncio
from typing import List, Any
import logging
from db import Database

logger = logging.getLogger(__name__)

async def log_search_event(
    session_id: str | None,
    query_text: str | None,
    has_image_query: bool,
    matched_product_ids: List[str],
    similarity_scores: List[float],
    applied_threshold: float,
    processing_latency_ms: int,
    result_count: int,
    is_zero_result: bool
) -> None:
    """
    Logs a search event to the search_telemetry table.
    Designed to be called via asyncio.create_task to avoid blocking the main request thread.
    """
    query = """
        INSERT INTO search_telemetry (
            session_id,
            query_text,
            has_image_query,
            matched_product_ids,
            similarity_scores,
            applied_threshold,
            processing_latency_ms,
            result_count,
            is_zero_result
        ) VALUES ($1, $2, $3, $4::uuid[], $5::numeric[], $6, $7, $8, $9)
    """
    
    # We use fire-and-forget for telemetry so it doesn't fail the user's search if telemetry is down
    try:
        await Database.execute(
            query,
            session_id,
            query_text,
            has_image_query,
            matched_product_ids,
            similarity_scores,
            applied_threshold,
            processing_latency_ms,
            result_count,
            is_zero_result
        )
    except Exception as e:
        logger.error(f"Failed to log search telemetry: {e}")

