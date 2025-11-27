from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from .db import engine, get_session
from .config.settings import settings
from .middleware.auth_middleware import AuthMiddleware
from .routes.users import router as users_router


pass


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(AuthMiddleware)




app.include_router(users_router)


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
