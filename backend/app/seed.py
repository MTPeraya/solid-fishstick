"""
Comprehensive seeding script for minimart POS system
Supports seeding all data at once or individual components
"""
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import random
from sqlmodel import Session, select, SQLModel
from passlib.context import CryptContext
from .db import engine
from .models.user import User
from .models.product import Product
from .models.member import Member
from .models.membership_tier import MembershipTier
from .models.transaction import Transaction
from .models.cashier import Cashier
from .models.manager import Manager
from .models.transaction_item import TransactionItem
from .models import promotion as _promotion_model

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def ensure_schema(reset: bool = False):
    """Create or reset database schema"""
    if reset:
        SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def clear_all_data(session: Session):
    """Clear all data from database (keeps schema)"""
    # Delete in correct order due to foreign keys
    session.exec(select(TransactionItem)).all()
    for item in session.exec(select(TransactionItem)).all():
        session.delete(item)
    
    for tx in session.exec(select(Transaction)).all():
        session.delete(tx)
    
    for member in session.exec(select(Member)).all():
        session.delete(member)
    
    for product in session.exec(select(Product)).all():
        session.delete(product)
    
    for cashier in session.exec(select(Cashier)).all():
        session.delete(cashier)
    
    for manager in session.exec(select(Manager)).all():
        session.delete(manager)
    
    for user in session.exec(select(User)).all():
        session.delete(user)
    
    session.commit()


# ============================================================================
# SEEDING FUNCTIONS
# ============================================================================

def seed_membership_tiers(session: Session) -> list[str]:
    """Seed membership tier levels"""
    tiers_data = [
        ("Bronze", Decimal("0.00"), Decimal("4999.99"), Decimal("3.00"), "Basic benefits"),
        ("Silver", Decimal("5000.00"), Decimal("19999.99"), Decimal("5.00"), "Priority support"),
        ("Gold", Decimal("20000.00"), Decimal("59999.99"), Decimal("8.00"), "Premium benefits"),
        ("Platinum", Decimal("60000.00"), None, Decimal("12.00"), "Elite benefits")
    ]
    
    tier_names = []
    for name, min_spent, max_spent, discount_rate, benefits in tiers_data:
        tier = session.exec(select(MembershipTier).where(MembershipTier.rank_name == name)).first()
        if not tier:
            tier = MembershipTier(
                rank_name=name,
                min_spent=min_spent,
                max_spent=max_spent,
                discount_rate=discount_rate,
                benefits=benefits
            )
            session.add(tier)
        tier_names.append(name)
    
    session.commit()
    return tier_names


def seed_users(session: Session, num_managers: int = 2, num_cashiers: int = 8) -> dict:
    """Seed user accounts (managers and cashiers)"""
    user_ids = {"managers": [], "cashiers": []}
    
    # Create managers
    for i in range(1, num_managers + 1):
        email = f"manager{i}@example.com"
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            hashed = pwd_context.hash("secret12")
            user = User(
                email=email,
                username=f"manager{i}",
                name=f"Manager {i}",
                hashed_password=hashed,
                role="manager"
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            
            # Create manager record
            if not session.exec(select(Manager).where(Manager.admin_id == user.uid)).first():
                session.add(Manager(admin_id=user.uid))
        
        user_ids["managers"].append(user.uid)
    
    # Create cashiers
    for i in range(1, num_cashiers + 1):
        email = f"cashier{i}@example.com"
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            hashed = pwd_context.hash("secret12")
            user = User(
                email=email,
                username=f"cashier{i}",
                name=f"Cashier {i}",
                hashed_password=hashed,
                role="cashier"
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            
            # Create cashier record
            if not session.exec(select(Cashier).where(Cashier.employee_id == user.uid)).first():
                session.add(Cashier(employee_id=user.uid))
        
        user_ids["cashiers"].append(user.uid)
    
    session.commit()
    return user_ids


def seed_products(session: Session, count: int = 40) -> list[int]:
    """Seed realistic product catalog"""
    brands = [
        "Acme", "FreshFarm", "CleanCo", "BakeCo", "RiceCo", "SnackCo", "DrinkCo",
        "DairyPure", "FitLife", "QuickBite", "GlowCare", "HomeWorks", "Sparkle",
        "ChillBeverages", "NutriMax", "VeggieVale", "OceanFresh"
    ]
    
    categories_data = {
        "Drinks": {
            "names": ["Drinking Water 500ml", "Orange Juice 1L", "Cola 330ml", "Green Tea", "Energy Drink", "Soda Water", "Iced Coffee"],
            "cost_range": (8, 25),
            "margin": 0.25
        },
        "Dairy": {
            "names": ["Whole Milk 1L", "Yogurt", "Cheddar Cheese", "Butter 200g", "Cream", "Chocolate Milk"],
            "cost_range": (25, 80),
            "margin": 0.20
        },
        "Bakery": {
            "names": ["White Bread", "Croissant", "Muffin", "Bagel", "Baguette", "Donut"],
            "cost_range": (15, 35),
            "margin": 0.30
        },
        "Groceries": {
            "names": ["Thai Jasmine Rice 5kg", "Sugar 1kg", "Salt 500g", "Cooking Oil 1L", "Fish Sauce", "Soy Sauce"],
            "cost_range": (30, 150),
            "margin": 0.18
        },
        "Personal Care": {
            "names": ["Hand Soap", "Shampoo", "Toothpaste", "Body Wash", "Face Cleanser", "Deodorant"],
            "cost_range": (20, 120),
            "margin": 0.35
        },
        "Snacks": {
            "names": ["Potato Chips", "Chocolate Bar", "Granola", "Crackers", "Popcorn", "Cookies"],
            "cost_range": (15, 45),
            "margin": 0.28
        },
        "Household": {
            "names": ["Laundry Detergent", "Dish Soap", "Paper Towels", "Trash Bags", "Air Freshener", "Sponges"],
            "cost_range": (35, 150),
            "margin": 0.22
        },
        "Produce": {
            "names": ["Bananas 1kg", "Apples 1kg", "Carrots 500g", "Tomatoes 500g", "Lettuce", "Onions 1kg"],
            "cost_range": (10, 60),
            "margin": 0.40
        },
        "Frozen": {
            "names": ["Frozen Dumplings", "Ice Cream", "Frozen Fries", "Frozen Pizza", "Frozen Berries"],
            "cost_range": (35, 180),
            "margin": 0.25
        },
        "Canned": {
            "names": ["Canned Tuna", "Canned Corn", "Canned Beans", "Canned Tomatoes", "Canned Soup"],
            "cost_range": (20, 65),
            "margin": 0.20
        }
    }
    
    product_ids = []
    categories = list(categories_data.keys())
    
    for i in range(count):
        category = categories[i % len(categories)]
        cat_data = categories_data[category]
        
        brand = random.choice(brands)
        name = random.choice(cat_data["names"])
        full_name = f"{brand} {name}"
        
        cost_min, cost_max = cat_data["cost_range"]
        cost = Decimal(random.randint(cost_min, cost_max))
        sell = (cost * (Decimal("1.00") + Decimal(str(cat_data["margin"])))).quantize(Decimal("1.00"))
        
        # Only 15% of products should be below minimum threshold (low stock)
        min_stock = random.randint(5, 20)
        if random.random() < 0.15:  # 15% chance of low stock
            stock = random.randint(0, min_stock - 1)  # Below threshold
        else:
            stock = random.randint(min_stock + 5, 250)  # Above threshold
        
        barcode = f"{1000000000000 + i:013d}"
        
        # Check if product exists
        product = session.exec(select(Product).where(Product.barcode == barcode)).first()
        if not product:
            product = Product(
                barcode=barcode,
                name=full_name,
                brand=brand,
                category=category,
                cost_price=cost,
                selling_price=sell,
                stock_quantity=stock,
                min_stock=min_stock
            )
            session.add(product)
            session.commit()
            session.refresh(product)
        
        product_ids.append(product.product_id)
    
    return product_ids


def seed_members(session: Session, count: int = 10) -> list[int]:
    """Seed member accounts"""
    member_ids = []
    
    for i in range(count):
        phone = f"081{str(i).zfill(7)}"
        member = session.exec(select(Member).where(Member.phone == phone)).first()
        if not member:
            member = Member(
                name=f"Member {i + 1}",
                phone=phone,
                registration_date=date.today() - timedelta(days=random.randint(0, 365))
            )
            session.add(member)
            session.commit()
            session.refresh(member)
        
        member_ids.append(member.member_id)
    
    return member_ids


def seed_transactions(session: Session, num_transactions: int = 50, days_back: int = 30) -> int:
    """Seed realistic transactions with items"""
    # Get all necessary data
    cashiers = session.exec(select(User).where(User.role == "cashier")).all()
    if not cashiers:
        print("No cashiers found. Please seed users first.")
        return 0
    
    products = session.exec(select(Product)).all()
    if not products:
        print("No products found. Please seed products first.")
        return 0
    
    members = session.exec(select(Member)).all()
    
    payment_methods = ["Cash", "Card", "QR Code"]
    now = datetime.now(timezone.utc)
    
    transactions_created = 0
    
    for i in range(num_transactions):
        # Random date within specified days
        tx_date = now - timedelta(
            days=random.randint(0, days_back),
            hours=random.randint(8, 22),
            minutes=random.randint(0, 59)
        )
        
        # Random cashier
        cashier = random.choice(cashiers)
        
        # 70% chance of member transaction
        member = random.choice(members) if members and random.random() < 0.7 else None
        
        # Select 1-6 random products
        num_items = random.randint(1, 6)
        selected_products = random.sample(products, min(num_items, len(products)))
        
        # Calculate transaction totals
        subtotal = Decimal("0.00")
        items_data = []
        
        for prod in selected_products:
            quantity = random.randint(1, 4)
            unit_price = prod.selling_price
            discount = Decimal("0.00")
            line_total = (unit_price * quantity) - discount
            subtotal += line_total
            
            items_data.append({
                "product_id": prod.product_id,
                "quantity": quantity,
                "unit_price": unit_price,
                "discount_amount": discount,
                "line_total": line_total
            })
        
        # Apply membership discount if member
        membership_discount = Decimal("0.00")
        if member:
            membership_discount = (subtotal * member.discount_rate / Decimal("100")).quantize(Decimal("0.01"))
        
        total_amount = subtotal - membership_discount
        
        # Create transaction
        tx = Transaction(
            transaction_date=tx_date,
            employee_id=cashier.uid,
            member_id=member.member_id if member else None,
            subtotal=subtotal,
            product_discount=Decimal("0.00"),
            membership_discount=membership_discount,
            total_amount=total_amount,
            payment_method=random.choice(payment_methods)
        )
        session.add(tx)
        session.commit()
        session.refresh(tx)
        
        # Create transaction items
        for item_data in items_data:
            tx_item = TransactionItem(
                transaction_id=tx.transaction_id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                discount_amount=item_data["discount_amount"],
                line_total=item_data["line_total"]
            )
            session.add(tx_item)
        
        session.commit()
        transactions_created += 1
    
    return transactions_created


# ============================================================================
# MAIN SEEDING FUNCTIONS
# ============================================================================

def seed_all(
    reset: bool = False,
    num_managers: int = 2,
    num_cashiers: int = 8,
    num_products: int = 40,
    num_members: int = 10,
    num_transactions: int = 50,
    days_back: int = 30
) -> dict:
    """Seed all data at once"""
    ensure_schema(reset=reset)
    
    result = {}
    
    with Session(engine) as session:
        if reset:
            clear_all_data(session)
        
        print("Seeding membership tiers...")
        result["tiers"] = seed_membership_tiers(session)
        
        print(f"Seeding users ({num_managers} managers, {num_cashiers} cashiers)...")
        result["users"] = seed_users(session, num_managers, num_cashiers)
        
        print(f"Seeding {num_products} products...")
        result["products"] = seed_products(session, num_products)
        
        print(f"Seeding {num_members} members...")
        result["members"] = seed_members(session, num_members)
        
        print(f"Seeding {num_transactions} transactions (last {days_back} days)...")
        result["transactions_created"] = seed_transactions(session, num_transactions, days_back)
    
    print("✅ Seeding completed successfully!")
    return result


# ============================================================================
# INDIVIDUAL COMPONENT SEEDING
# ============================================================================

def seed_only_tiers(reset: bool = False) -> dict:
    """Seed only membership tiers"""
    ensure_schema(reset=reset)
    with Session(engine) as session:
        tiers = seed_membership_tiers(session)
    return {"tiers": tiers}


def seed_only_users(num_managers: int = 2, num_cashiers: int = 8, reset: bool = False) -> dict:
    """Seed only users"""
    ensure_schema(reset=reset)
    with Session(engine) as session:
        if reset:
            for user in session.exec(select(User)).all():
                session.delete(user)
            session.commit()
        users = seed_users(session, num_managers, num_cashiers)
    return {"users": users}


def seed_only_products(count: int = 40, reset: bool = False) -> dict:
    """Seed only products"""
    ensure_schema(reset=reset)
    with Session(engine) as session:
        if reset:
            # Delete transaction items first (foreign key)
            for ti in session.exec(select(TransactionItem)).all():
                session.delete(ti)
            for prod in session.exec(select(Product)).all():
                session.delete(prod)
            session.commit()
        products = seed_products(session, count)
    return {"products": products}


def seed_only_members(count: int = 10, reset: bool = False) -> dict:
    """Seed only members"""
    ensure_schema(reset=reset)
    with Session(engine) as session:
        if reset:
            # Delete transactions first (foreign key)
            for ti in session.exec(select(TransactionItem)).all():
                session.delete(ti)
            for tx in session.exec(select(Transaction)).all():
                session.delete(tx)
            for member in session.exec(select(Member)).all():
                session.delete(member)
            session.commit()
        
        # Ensure tiers exist
        seed_membership_tiers(session)
        members = seed_members(session, count)
    return {"members": members}


def seed_only_transactions(count: int = 50, days_back: int = 30, reset: bool = False) -> dict:
    """Seed only transactions"""
    ensure_schema(reset=reset)
    with Session(engine) as session:
        if reset:
            for ti in session.exec(select(TransactionItem)).all():
                session.delete(ti)
            for tx in session.exec(select(Transaction)).all():
                session.delete(tx)
            session.commit()
        transactions = seed_transactions(session, count, days_back)
    return {"transactions_created": transactions}


# ============================================================================
# CLI INTERFACE
# ============================================================================

if __name__ == "__main__":
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description="Seed minimart POS database")
    
    # Main commands
    parser.add_argument("--all", action="store_true", help="Seed all data at once")
    parser.add_argument("--tiers", action="store_true", help="Seed only membership tiers")
    parser.add_argument("--users", action="store_true", help="Seed only users")
    parser.add_argument("--products", action="store_true", help="Seed only products")
    parser.add_argument("--members", action="store_true", help="Seed only members")
    parser.add_argument("--transactions", action="store_true", help="Seed only transactions")
    
    # Options
    parser.add_argument("--reset", action="store_true", help="Reset/clear existing data before seeding")
    parser.add_argument("--reset-schema", action="store_true", help="Drop and recreate all tables")
    
    # Counts
    parser.add_argument("--managers", type=int, default=2, help="Number of managers (default: 2)")
    parser.add_argument("--cashiers", type=int, default=8, help="Number of cashiers (default: 8)")
    parser.add_argument("--product-count", type=int, default=40, help="Number of products (default: 40)")
    parser.add_argument("--member-count", type=int, default=10, help="Number of members (default: 10)")
    parser.add_argument("--transaction-count", type=int, default=50, help="Number of transactions (default: 50)")
    parser.add_argument("--days-back", type=int, default=30, help="Days back for transactions (default: 30)")
    
    args = parser.parse_args()
    
    result = {}
    
    try:
        if args.all:
            # Seed everything
            result = seed_all(
                reset=args.reset_schema,
                num_managers=args.managers,
                num_cashiers=args.cashiers,
                num_products=args.product_count,
                num_members=args.member_count,
                num_transactions=args.transaction_count,
                days_back=args.days_back
            )
        
        elif args.tiers:
            result = seed_only_tiers(reset=args.reset)
        
        elif args.users:
            result = seed_only_users(
                num_managers=args.managers,
                num_cashiers=args.cashiers,
                reset=args.reset
            )
        
        elif args.products:
            result = seed_only_products(
                count=args.product_count,
                reset=args.reset
            )
        
        elif args.members:
            result = seed_only_members(
                count=args.member_count,
                reset=args.reset
            )
        
        elif args.transactions:
            result = seed_only_transactions(
                count=args.transaction_count,
                days_back=args.days_back,
                reset=args.reset
            )
        
        else:
            # Default: seed all with defaults
            print("No specific command provided. Seeding all data with defaults...")
            result = seed_all()
        
        print(json.dumps(result, indent=2, default=str))
    
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
