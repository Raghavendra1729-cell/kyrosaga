import pytest
from src.image_compression import compress_image

def test_compress_image_success(sample_image_bytes):
    compressed = compress_image(sample_image_bytes)
    assert compressed is not None
    assert len(compressed) > 0
    # The output format might be WebP or PNG depending on the implementation
    # It should at least be bytes
    assert isinstance(compressed, bytes)

def test_compress_image_invalid_bytes():
    with pytest.raises(Exception):
        compress_image(b"invalid image bytes")

def test_compress_image_empty_bytes():
    with pytest.raises(Exception):
        compress_image(b"")
