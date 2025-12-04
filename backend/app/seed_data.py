# backend/app/seed_data.py

from datetime import date
from decimal import Decimal
from passlib.context import CryptContext

# ใช้ Relative Imports เนื่องจากไฟล์นี้อยู่ใน 'app' package
from .db import engine, get_session
from .models.user import User
from .models.membership_tier import MembershipTier
from .models.promotion import Promotion
from .models.product import Product
from sqlmodel import Session, select

# Hashing context for user passwords
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def create_initial_tiers(session: Session):
    print("Seeding Membership Tiers...")
    tiers = [
        MembershipTier(rank_name='Bronze', min_spent=Decimal('0.00'), max_spent=Decimal('5000.00'), discount_rate=Decimal('3.00'), benefits='3% discount on all purchases'),
        MembershipTier(rank_name='Silver', min_spent=Decimal('5000.01'), max_spent=Decimal('10000.00'), discount_rate=Decimal('5.00'), benefits='5% discount, priority checkout'),
        MembershipTier(rank_name='Gold', min_spent=Decimal('10000.01'), max_spent=Decimal('50000.00'), discount_rate=Decimal('10.00'), benefits='10% discount, birthday gift'),
        MembershipTier(rank_name='Platinum', min_spent=Decimal('50000.01'), max_spent=None, discount_rate=Decimal('15.00'), benefits='15% discount, VIP lounge'),
    ]
    for tier in tiers:
        existing = session.get(MembershipTier, tier.rank_name)
        if not existing:
            session.add(tier)
    session.commit()

def create_initial_promotions(session: Session):
    print("Seeding Promotions...")
    promotions = [
        Promotion(
            promotion_id=1, promotion_name='Summer Beverage Sale', discount_type='PERCENTAGE', 
            discount_value=Decimal('20.00'), start_date=date(2024, 11, 1), end_date=date(2025, 3, 31), is_active=True
        ),
        Promotion(
            promotion_id=2, promotion_name='Snack Clearance', discount_type='FIXED', 
            discount_value=Decimal('5.00'), start_date=date(2024, 12, 1), end_date=date(2025, 1, 31), is_active=True
        ),
    ]
    for promo in promotions:
        # ใช้ upsert/check เพื่อป้องกันการซ้ำในกรณีที่รันหลายครั้ง
        existing = session.get(Promotion, promo.promotion_id)
        if not existing:
            session.add(promo)
    session.commit()

def create_initial_users(session: Session):
    print("Seeding Users (Manager and Cashier)...")
    users = [
        User(
            email='manager@minimart.com', username='admin', name='Tom Wilson (Manager)', role='manager', 
            hashed_password=pwd_context.hash('securepassword')
        ),
        User(
            email='cashier@minimart.com', username='johnc', name='John Smith (Cashier)', role='cashier', 
            hashed_password=pwd_context.hash('securepassword')
        ),
    ]
    for user in users:
        existing = session.exec(select(User).where(User.email == user.email)).first()
        if not existing:
            session.add(user)
    session.commit()

def create_initial_products(session: Session):
    print("Seeding Products...")
    products = [
        Product(
            barcode='8851234567890', name="Lay's Classic 48g", brand="Lay's", category='Snacks', 
            cost_price=Decimal('15.00'), selling_price=Decimal('20.00'), 
            stock_quantity=100, min_stock=20, promotion_id=None
        ),
        Product(
            barcode='8851234567891', name='Coca Cola 325ml', brand='Coca-Cola', category='Beverages', 
            cost_price=Decimal('10.00'), selling_price=Decimal('15.00'), 
            stock_quantity=10, min_stock=50, promotion_id=1 
        ),
        Product(
            barcode='8851234567892', name='Pepsi 325ml', brand='Pepsi', category='Beverages', 
            cost_price=Decimal('10.00'), selling_price=Decimal('15.00'), 
            stock_quantity=150, min_stock=50, promotion_id=1
        ),
        Product(
            barcode='8851234567893', name='Mama Noodles', brand='Thai President', category='Instant Food', 
            cost_price=Decimal('5.00'), selling_price=Decimal('8.00'), 
            stock_quantity=300, min_stock=50, promotion_id=None
        ),
    ]
    for product in products:
        existing = session.exec(select(Product).where(Product.barcode == product.barcode)).first()
        if not existing:
            session.add(product)
    session.commit()


def seed_all():
    print("Starting database seeding...")
    with next(get_session()) as session:
        create_initial_tiers(session)
        create_initial_promotions(session)
        create_initial_users(session)
        create_initial_products(session)
        
        print("Database seeding completed.")

if __name__ == "__main__":
    seed_all()