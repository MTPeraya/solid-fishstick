from sqlmodel import Session, select
from passlib.context import CryptContext
from fastapi import HTTPException, status
from ..models.user import User
from ..schemas.user_schema import UserCreate, UserLogin, UserRead, Token
from ..utils.jwt import create_access_token


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def signup(data: UserCreate, session: Session) -> UserRead:
    statement = select(User).where(User.email == data.email)
    existing = session.exec(statement).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed = pwd_context.hash(data.password)
    user = User(email=str(data.email), hashed_password=hashed)
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead(id=user.id, email=user.email, is_active=user.is_active, created_at=user.created_at)


def signin(data: UserLogin, session: Session) -> Token:
    statement = select(User).where(User.email == data.email)
    user = session.exec(statement).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not pwd_context.verify(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(user_id=user.id)
    return Token(access_token=token)


def to_user_read(user: User) -> UserRead:
    return UserRead(id=user.id, email=user.email, is_active=user.is_active, created_at=user.created_at)