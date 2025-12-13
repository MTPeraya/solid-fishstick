from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from .db import engine, get_session
from .config.settings import settings
from .middleware.auth_middleware import AuthMiddleware
from .routes.users import router as users_router
from .routes.products import router as products_router
from .routes.transactions import router as transactions_router
from .routes.promotions import router as promotions_router
from .routes.members import router as members_router
from .models import product as _product_model
from .models import promotion as _promotion_model
from .models import membership_tier as _membership_tier_model
from .models import member as _member_model
from .models import cashier as _cashier_model
from .models import transaction as _transaction_model
from .models import transaction_item as _transaction_item_model
from .models import user as _user_model


pass


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(AuthMiddleware)


app.include_router(users_router)
app.include_router(products_router)
app.include_router(transactions_router)
app.include_router(promotions_router) 
app.include_router(members_router)


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    