"""Public contract: envelope and page response models."""

from app.public.schemas import PageMeta, PageResponse, envelope


def test_envelope_without_meta():
    assert envelope({"id": 1}) == {"data": {"id": 1}}


def test_envelope_with_meta():
    assert envelope([1, 2], {"total": 2}) == {"data": [1, 2], "meta": {"total": 2}}


def test_page_response_roundtrip():
    page = PageResponse[int](data=[1, 2], meta=PageMeta(page=1, page_size=2, total=5))
    dumped = page.model_dump()
    assert dumped["meta"] == {"page": 1, "page_size": 2, "total": 5}
    assert dumped["data"] == [1, 2]
