from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, get_session
from .config.settings import settings
from .middleware.auth_middleware import AuthMiddleware
from .routes.items import router as items_router
from .routes.users import router as users_router


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




app.include_router(items_router)
app.include_router(users_router)
