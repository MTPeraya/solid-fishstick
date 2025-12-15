from datetime import date
from decimal import Decimal
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
        get_or_create_tier(session, "Bronze", Decimal("0.00"), Decimal("4999.99"), Decimal("3.00"), "Basic benefits")
        get_or_create_tier(session, "Silver", Decimal("5000.00"), Decimal("19999.99"), Decimal("5.00"), "Priority support")
        get_or_create_tier(session, "Gold", Decimal("20000.00"), Decimal("59999.99"), Decimal("8.00"), "Premium benefits")
        get_or_create_tier(session, "Platinum", Decimal("60000.00"), None, Decimal("12.00"), "Elite benefits")

        user_uids: list[str] = []
        for i in range(1, 3):
            u = get_or_create_user(session, f"manager{i}@example.com", f"manager{i}", f"Manager {i}", "manager", "secret12")
            user_uids.append(u.uid)
        for i in range(1, 9):
            u = get_or_create_user(session, f"cashier{i}@example.com", f"cashier{i}", f"Cashier {i}", "cashier", "secret12")
            user_uids.append(u.uid)
        out["users"] = user_uids
        for uid in user_uids:
            u = session.exec(select(User).where(User.uid == uid)).first()
            if not u:
                continue
            if u.role == "cashier":
                if not session.exec(select(Cashier).where(Cashier.employee_id == uid)).first():
                    session.add(Cashier(employee_id=uid))
            if u.role == "manager":
                if not session.exec(select(Manager).where(Manager.admin_id == uid)).first():
                    session.add(Manager(admin_id=uid))
        session.commit()
        # Seed sample members
        members: list[int] = []
        for i, (name, phone) in enumerate([
            ("Alice", "0810000000"),
            ("Bob", "0820000000"),
            ("Charlie", "0830000000"),
            ("Diana", "0840000000"),
            ("Eve", "0850000000"),
        ]):
            m = session.exec(select(Member).where(Member.phone == phone)).first()
            if not m:
                m = Member(name=name, phone=phone, registration_date=date.today())
                session.add(m)
                session.commit()
                session.refresh(m)
            members.append(m.member_id)
        out["members"] = members

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
        cashier_uid = session.exec(select(User).where(User.role == "cashier")).first().uid
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        for i, mid in enumerate(members[:3]):
            t1 = Transaction(transaction_date=now - timedelta(days=i * 30), employee_id=cashier_uid, member_id=mid, subtotal=Decimal("1500.00"), product_discount=Decimal("0.00"), membership_discount=Decimal("0.00"), total_amount=Decimal("1500.00"), payment_method="Cash")
            session.add(t1)
        session.commit()

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
    parser.add_argument("--members-only", action="store_true", help="Seed only membership tiers and members")
    parser.add_argument("--reset-members", action="store_true", help="Delete all existing members and related transactions before seeding")
    parser.add_argument("--count", type=int, default=40, help="Number to seed for products/users-only mode")
    parser.add_argument("--managers", type=int, default=None, help="Number of managers to seed in users-only mode")
    parser.add_argument("--cashiers", type=int, default=None, help="Number of cashiers to seed in users-only mode")
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

    def seed_users_only(count: int | None = None, reset_users: bool = False, managers: int | None = None, cashiers: int | None = None) -> dict:
        SQLModel.metadata.create_all(engine)
        out: dict = {}
        with Session(engine) as session:
            if reset_users:
                delete_all_users(session)
            uids: list[str] = []
            if managers is not None or cashiers is not None:
                mcount = max(0, managers or 0)
                ccount = max(0, cashiers or 0)
            else:
                total = count if count is not None else 10
                mcount = min(2, max(0, total))
                ccount = max(0, total - mcount)
            for i in range(1, mcount + 1):
                u = get_or_create_user(session, f"manager{i}@example.com", f"manager{i}", f"Manager {i}", "manager", "secret12")
                uids.append(u.uid)
            for i in range(1, ccount + 1):
                u = get_or_create_user(session, f"cashier{i}@example.com", f"cashier{i}", f"Cashier {i}", "cashier", "secret12")
                uids.append(u.uid)
            out["users"] = uids
        return out

    def delete_all_members(session: Session):
        txs = session.exec(select(Transaction)).all()
        for tx in txs:
            items = session.exec(select(TransactionItem).where(TransactionItem.transaction_id == tx.transaction_id)).all()
            for it in items:
                session.delete(it)
            session.delete(tx)
        members = session.exec(select(Member)).all()
        for m in members:
            session.delete(m)
        session.commit()

    def seed_members_only(count: int = 5, reset_members: bool = False) -> dict:
        SQLModel.metadata.create_all(engine)
        out: dict = {}
        with Session(engine) as session:
            if reset_members:
                delete_all_members(session)
            get_or_create_tier(session, "Bronze", Decimal("0.00"), Decimal("4999.99"), Decimal("3.00"), "Basic benefits")
            get_or_create_tier(session, "Silver", Decimal("5000.00"), Decimal("19999.99"), Decimal("5.00"), "Priority support")
            get_or_create_tier(session, "Gold", Decimal("20000.00"), Decimal("59999.99"), Decimal("8.00"), "Premium benefits")
            get_or_create_tier(session, "Platinum", Decimal("60000.00"), None, Decimal("12.00"), "Elite benefits")
            members: list[int] = []
            for i in range(count):
                name = f"Member {i+1}"
                phone = f"081{str(i).zfill(7)}"
                m = get_or_create_member(session, name, phone, date.today())
                members.append(m.member_id)
            out["members"] = members

            # Ensure at least one cashier exists to attach transactions to
            cashier_user = get_or_create_user(session, "seedcashier@example.com", "seedcashier", "Seed Cashier", "cashier", "secret12")
            if not session.exec(select(Cashier).where(Cashier.employee_id == cashier_user.uid)).first():
                session.add(Cashier(employee_id=cashier_user.uid))
                session.commit()

            # Seed transactions per member to cover all tiers in rolling-year spend
            from datetime import datetime, timezone, timedelta
            now = datetime.now(timezone.utc)
            tier_targets = [
                Decimal("3000.00"),   # Bronze (0–4999.99)
                Decimal("10000.00"),  # Silver (5000–19999.99)
                Decimal("30000.00"),  # Gold (20000–59999.99)
                Decimal("80000.00"),  # Platinum (60000+)
            ]
            day_offsets = [20, 60, 120, 200, 280]  # all within the last year
            for idx, mid in enumerate(members):
                target = tier_targets[idx % len(tier_targets)]
                # Split target into 5 chunks to create multiple transactions
                # Use simple proportional splits that sum to 100%
                splits = [Decimal("0.25"), Decimal("0.20"), Decimal("0.15"), Decimal("0.20"), Decimal("0.20")]
                for j, frac in enumerate(splits):
                    amt = (target * frac).quantize(Decimal("0.01"))
                    tx = Transaction(
                        transaction_date=now - timedelta(days=day_offsets[j]),
                        employee_id=cashier_user.uid,
                        member_id=mid,
                        subtotal=amt,
                        product_discount=Decimal("0.00"),
                        membership_discount=Decimal("0.00"),
                        total_amount=amt,
                        payment_method="Cash",
                    )
                    session.add(tx)
            session.commit()
        return out

    if args.products_only:
        result = seed_products_only(count=args.count, reset_products=args.reset_products)
    elif args.users_only:
        result = seed_users_only(count=args.count, reset_users=args.reset_users, managers=args.managers, cashiers=args.cashiers)
    elif args.members_only:
        result = seed_members_only(count=args.count, reset_members=args.reset_members)
    else:
        result = seed(reset=args.reset)
    print(json.dumps(result))
