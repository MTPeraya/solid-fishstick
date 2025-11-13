from typing import List, Dict


_items: List[Dict] = []


def list_items() -> List[Dict]:
    return _items


def create_item(item: Dict) -> Dict:
    _items.append(item)
    return item