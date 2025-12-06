from datetime import date
from decimal import Decimal
from sqlmodel import Session, select, SQLModel
from passlib.context import CryptContext
from .db import engine
from .models.user import User
from .models.product import Product
from .models.member import Member
from .models.membership_tier import MembershipTier
from .models import promotion as _promotion_model


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def ensure_schema(reset: bool = False):
    if reset:
        SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def get_or_create_user(session: Session, email: str, username: str, name: str, role: str, password: str) -> User:
    u = session.exec(select(User).where(User.email == email)).first()
    if u:
        return u
    if session.exec(select(User).where(User.username == username)).first():
        username = f"{username}{date.today().strftime('%Y%m%d')}"
    hashed = pwd_context.hash(password)
    u = User(email=email, username=username, name=name, hashed_password=hashed, role=role)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def get_or_create_tier(session: Session, name: str, min_spent: Decimal, max_spent: Decimal | None, discount_rate: Decimal, benefits: str | None = None) -> MembershipTier:
    t = session.exec(select(MembershipTier).where(MembershipTier.rank_name == name)).first()
    if t:
        return t
    t = MembershipTier(rank_name=name, min_spent=min_spent, max_spent=max_spent, discount_rate=discount_rate, benefits=benefits)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


def get_or_create_product(session: Session, barcode: str, name: str, brand: str | None, category: str | None, cost_price: Decimal, selling_price: Decimal, stock_quantity: int, min_stock: int) -> Product:
    p = session.exec(select(Product).where(Product.barcode == barcode)).first()
    if p:
        return p
    p = Product(barcode=barcode, name=name, brand=brand, category=category, cost_price=cost_price, selling_price=selling_price, stock_quantity=stock_quantity, min_stock=min_stock)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def get_or_create_member(session: Session, name: str, phone: str, registration_date: date) -> Member:
    m = session.exec(select(Member).where(Member.phone == phone)).first()
    if m:
        return m
    m = Member(name=name, phone=phone, registration_date=registration_date)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def seed(reset: bool = False) -> dict:
    ensure_schema(reset=reset)
    out: dict = {}
    with Session(engine) as session:
        get_or_create_tier(session, "Bronze", Decimal("0.00"), Decimal("1000.00"), Decimal("3.00"), "Basic benefits")
        get_or_create_tier(session, "Silver", Decimal("1000.00"), Decimal("5000.00"), Decimal("5.00"), "Priority support")
        get_or_create_tier(session, "Gold", Decimal("5000.00"), None, Decimal("10.00"), "Premium benefits")

        user_uids: list[str] = []
        for i in range(1, 3):
            u = get_or_create_user(session, f"manager{i}@example.com", f"manager{i}", f"Manager {i}", "manager", "secret12")
            user_uids.append(u.uid)
        for i in range(1, 9):
            u = get_or_create_user(session, f"cashier{i}@example.com", f"cashier{i}", f"Cashier {i}", "cashier", "secret12")
            user_uids.append(u.uid)
        out["users"] = user_uids

        products_data = [
            ("0000000000001", "Drinking Water", "Acme", "Drinks", Decimal("8.00"), Decimal("12.00"), 200, 10),
            ("0000000000002", "Whole Milk", "Acme", "Dairy", Decimal("25.00"), Decimal("32.00"), 150, 10),
            ("0000000000003", "White Bread", "BakeCo", "Bakery", Decimal("18.00"), Decimal("25.00"), 120, 15),
            ("0000000000004", "Thai Jasmine Rice 5kg", "RiceCo", "Groceries", Decimal("120.00"), Decimal("150.00"), 60, 5),
            ("0000000000005", "Hand Soap", "CleanCo", "Personal Care", Decimal("20.00"), Decimal("29.00"), 180, 20),
        ]
        product_ids: list[int] = []
        for bc, nm, br, cat, cp, sp, qty, minq in products_data:
            p = get_or_create_product(session, bc, nm, br, cat, cp, sp, qty, minq)
            product_ids.append(p.product_id or 0)
        out["products"] = product_ids

        member = get_or_create_member(session, "John Doe", "0912345678", date.today())
        out["member_id"] = member.member_id

    return out


if __name__ == "__main__":
    import argparse
    import json
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables, then seed full dataset")
    parser.add_argument("--products-only", action="store_true", help="Seed only products (no users/members/tiers)")
    parser.add_argument("--reset-products", action="store_true", help="Delete all existing products before seeding")
    parser.add_argument("--users-only", action="store_true", help="Seed only users")
    parser.add_argument("--reset-users", action="store_true", help="Delete all existing users before seeding users-only")
    parser.add_argument("--count", type=int, default=40, help="Number to seed for products/users-only mode")
    args = parser.parse_args()

    def delete_all_products(session: Session):
        items = session.exec(select(Product)).all()
        for it in items:
            session.delete(it)
        session.commit()

    def seed_products_only(count: int = 40, reset_products: bool = False) -> dict:
        SQLModel.metadata.create_all(engine)
        out: dict = {}
        brands = [
            "Acme","Acme","CleanCo","CleanCo","FreshFarm","FreshFarm","BakeCo","RiceCo","SnackCo","DrinkCo",
            "DairyPure","FitLife","QuickBite","GlowCare","HomeWorks","Sparkle","ChillBeverages","NutriMax","VeggieVale","OceanFresh",
        ]
        categories = [
            "Drinks","Dairy","Bakery","Groceries","Personal Care","Snacks","Household","Produce","Frozen","Canned",
        ]
        base_names = {
            "Drinks": ["Drinking Water","Orange Juice","Cola","Green Tea","Energy Drink"],
            "Dairy": ["Whole Milk","Yogurt","Cheddar Cheese","Butter","Cream"],
            "Bakery": ["White Bread","Croissant","Muffin","Bagel","Baguette"],
            "Groceries": ["Thai Jasmine Rice 5kg","Sugar 1kg","Salt 500g","Cooking Oil 1L","Fish Sauce"],
            "Personal Care": ["Hand Soap","Shampoo","Toothpaste","Body Wash","Face Cleanser"],
            "Snacks": ["Potato Chips","Chocolate Bar","Granola","Crackers","Popcorn"],
            "Household": ["Laundry Detergent","Dish Soap","Paper Towels","Trash Bags","Air Freshener"],
            "Produce": ["Bananas","Apples","Carrots","Tomatoes","Lettuce"],
            "Frozen": ["Frozen Dumplings","Ice Cream","Frozen Fries","Frozen Pizza","Frozen Berries"],
            "Canned": ["Canned Tuna","Canned Corn","Canned Beans","Canned Tomatoes","Canned Soup"],
        }
        base_cost = {
            "Drinks": Decimal("8.00"),
            "Dairy": Decimal("25.00"),
            "Bakery": Decimal("18.00"),
            "Groceries": Decimal("120.00"),
            "Personal Care": Decimal("20.00"),
            "Snacks": Decimal("15.00"),
            "Household": Decimal("45.00"),
            "Produce": Decimal("10.00"),
            "Frozen": Decimal("35.00"),
            "Canned": Decimal("22.00"),
        }
        margins = [Decimal("0.20"), Decimal("0.25"), Decimal("0.30"), Decimal("0.18"), Decimal("0.22")]

        with Session(engine) as session:
            if reset_products:
                delete_all_products(session)
            product_ids: list[int] = []
            for i in range(count):
                brand = brands[i % len(brands)]
                cat = categories[i % len(categories)]
                name_list = base_names[cat]
                base_name = name_list[i % len(name_list)]
                name = f"{brand} {base_name}"
                cost = base_cost[cat] + Decimal(i % 5)
                margin = margins[i % len(margins)]
                sell = (cost * (Decimal("1.00") + margin)).quantize(Decimal("1.00"))
                stock = 50 + (i * 3) % 200
                min_stock = 5 + (i % 15)
                barcode = f"{1000000000000 + i:013d}"

                p = session.exec(select(Product).where(Product.barcode == barcode)).first()
                if not p:
                    p = Product(barcode=barcode, name=name, brand=brand, category=cat, cost_price=cost, selling_price=sell, stock_quantity=stock, min_stock=min_stock)
                    session.add(p)
                    session.commit()
                    session.refresh(p)
                product_ids.append(p.product_id or 0)

        out["products"] = product_ids
        return out

    def delete_all_users(session: Session):
        items = session.exec(select(User)).all()
        for it in items:
            session.delete(it)
        session.commit()

    def seed_users_only(count: int = 10, reset_users: bool = False) -> dict:
        SQLModel.metadata.create_all(engine)
        out: dict = {}
        with Session(engine) as session:
            if reset_users:
                delete_all_users(session)
            uids: list[str] = []
            mcount = min(2, max(0, count))
            ccount = max(0, count - mcount)
            for i in range(1, mcount + 1):
                u = get_or_create_user(session, f"manager{i}@example.com", f"manager{i}", f"Manager {i}", "manager", "secret12")
                uids.append(u.uid)
            for i in range(1, ccount + 1):
                u = get_or_create_user(session, f"cashier{i}@example.com", f"cashier{i}", f"Cashier {i}", "cashier", "secret12")
                uids.append(u.uid)
            out["users"] = uids
        return out

    if args.products_only:
        result = seed_products_only(count=args.count, reset_products=args.reset_products)
    elif args.users_only:
        result = seed_users_only(count=args.count, reset_users=args.reset_users)
    else:
        result = seed(reset=args.reset)
    print(json.dumps(result))
