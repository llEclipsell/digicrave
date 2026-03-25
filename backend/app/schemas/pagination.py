from pydantic import BaseModel
from typing import TypeVar, Generic, List, Optional
import base64
import json

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Blueprint Pagination Contract:
    - Offset-based for Admin/CRM
    - Cursor-based for Live Orders/KDS
    """
    items: List[T]
    total_count: int
    has_more: bool
    next_cursor: Optional[str] = None


def encode_cursor(data: dict) -> str:
    """Encode cursor for next page"""
    return base64.b64encode(json.dumps(data).encode()).decode()


def decode_cursor(cursor: str) -> dict:
    """Decode cursor from request"""
    try:
        return json.loads(base64.b64decode(cursor).decode())
    except Exception:
        return {}


def make_paginated_response(
    items: list,
    total_count: int,
    limit: int,
    offset: int = None,
    last_id: str = None,
) -> dict:
    """
    Blueprint: Returns paginated response
    Default limit=20, max=100
    """
    has_more = (offset + len(items)) < total_count if offset is not None else len(items) == limit

    next_cursor = None
    if has_more and last_id:
        next_cursor = encode_cursor({"id": last_id})
    elif has_more and offset is not None:
        next_cursor = encode_cursor({"offset": offset + limit})

    return {
        "items": items,
        "total_count": total_count,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }