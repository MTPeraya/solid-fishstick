from fastapi import APIRouter
from typing import List
from ...handlers.items_handler import get_items, add_item, ItemIn, ItemOut


router = APIRouter(prefix="/api/v1/items", tags=["items"])


@router.get("", response_model=List[ItemOut])
def list_route():
    return get_items()


@router.post("", response_model=ItemOut)
def create_route(item: ItemIn):
    return add_item(item)