from fastapi import APIRouter, Depends
from sqlmodel import Session
from ...main import get_session
from ...schemas.user_schema import UserCreate, UserLogin, UserRead, Token
from ...handlers.users_handler import signup as signup_handler, signin as signin_handler, to_user_read
from ...utils.jwt import get_current_user
from ...models.user import User


router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.post("/signup", response_model=UserRead)
def signup(data: UserCreate, session: Session = Depends(get_session)):
    return signup_handler(data, session)


@router.post("/signin", response_model=Token)
def signin(data: UserLogin, session: Session = Depends(get_session)):
    return signin_handler(data, session)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return to_user_read(current_user)