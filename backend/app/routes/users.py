from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from ..db import get_session
from ..schemas.user_schema import UserCreate, UserLogin, UserRead, Token
from ..handlers.users_handler import signup as signup_handler, signin as signin_handler, to_user_read, list_users as list_users_handler, list_employees as list_employees_handler
from ..utils.jwt import get_current_user
from ..models.user import User
from typing import List


router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/signup", response_model=UserRead)
def signup(data: UserCreate, session: Session = Depends(get_session)):
    return signup_handler(data, session)


@router.post("/signin", response_model=Token)
def signin(data: UserLogin, session: Session = Depends(get_session)):
    return signin_handler(data, session)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return to_user_read(current_user)


@router.get("", response_model=List[UserRead])
def list_users(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return list_users_handler(session)

@router.get("/employees", response_model=list[UserRead])
def list_employees(
    role: str | None = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return list_employees_handler(session, role)
