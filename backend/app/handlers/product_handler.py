from typing import List
from sqlmodel import Session, select
from fastapi import HTTPException, status
from ..models.product import Product
from ..schemas.product_schema import ProductCreate, ProductRead, ProductUpdate, ProductStockUpdate


def create_product(data: ProductCreate, session: Session) -> ProductRead:
    # Check for existing barcode
    existing_product = session.exec(select(Product).where(Product.barcode == data.barcode)).first()
    if existing_product:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Barcode already exists")
    
    # Check selling price constraint before creation
    if data.selling_price < data.cost_price:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selling price cannot be less than cost price")

    product = Product.model_validate(data)
    
    session.add(product)
    session.commit()
    session.refresh(product)
    
    return ProductRead.model_validate(product)


def list_products(session: Session) -> List[ProductRead]:
    products = session.exec(select(Product)).all()
    return [ProductRead.model_validate(p) for p in products]


def get_product_by_id(product_id: int, session: Session) -> Product:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def read_product(product_id: int, session: Session) -> ProductRead:
    product = get_product_by_id(product_id, session)
    return ProductRead.model_validate(product)


def update_product(product_id: int, data: ProductUpdate, session: Session) -> ProductRead:
    product = get_product_by_id(product_id, session)

    update_data = data.model_dump(exclude_unset=True)
    
    # Manually check selling price constraint for updates
    new_cost_price = update_data.get('cost_price', product.cost_price)
    new_selling_price = update_data.get('selling_price', product.selling_price)
    
    if new_selling_price < new_cost_price:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selling price cannot be less than cost price")


    # Update attributes
    for key, value in update_data.items():
        setattr(product, key, value)

    session.add(product)
    session.commit()
    session.refresh(product)
    
    return ProductRead.model_validate(product)


def delete_product(product_id: int, session: Session):
    product = get_product_by_id(product_id, session)
    
    session.delete(product)
    session.commit()
    return {"message": "Product deleted successfully"}


def update_product_stock(product_id: int, data: ProductStockUpdate, session: Session) -> ProductRead:
    product = get_product_by_id(product_id, session)
    
    # Only update stock_quantity
    product.stock_quantity = data.stock_quantity
    
    session.add(product)
    session.commit()
    session.refresh(product)
    
    return ProductRead.model_validate(product)