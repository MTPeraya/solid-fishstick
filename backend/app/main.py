from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import create_engine, Session
from .config.settings import settings
from .middleware.auth_middleware import AuthMiddleware
from .routes.v1.items import router as items_router
from .routes.v1.users import router as users_router


engine = create_engine(settings.database_url, echo=False)


def get_session():
    with Session(engine) as session:
        yield session


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(AuthMiddleware)




app.include_router(items_router)
app.include_router(users_router)
