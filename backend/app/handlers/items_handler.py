from typing import List
from pydantic import BaseModel
from ..services.item_service import list_items, create_item


class ItemIn(BaseModel):
    name: str


class ItemOut(BaseModel):
    name: str


def get_items() -> List[ItemOut]:
    data = list_items()
    return [ItemOut(**d) for d in data]


def add_item(item: ItemIn) -> ItemOut:
    saved = create_item(item.dict())
    return ItemOut(**saved)