from sqlmodel import Session, select
from sqlalchemy import or_
from passlib.context import CryptContext
from fastapi import HTTPException, status
from ..models.user import User
from ..schemas.user_schema import UserCreate, UserLogin, UserRead, Token
from ..utils.jwt import create_access_token


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def signup(data: UserCreate, session: Session) -> UserRead:
    role = data.role.lower()
    if role not in ("cashier", "manager"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    existing_email = session.exec(select(User).where(User.email == data.email)).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    existing_username = session.exec(select(User).where(User.username == data.username)).first()
    if existing_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
    if role == "manager":
        from ..config.settings import settings
        if not data.manager_secret or data.manager_secret != settings.manager_signup_code:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager code invalid")
    hashed = pwd_context.hash(data.password)
    user = User(email=str(data.email), hashed_password=hashed, username=data.username, name=data.name, role=role)
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead(uid=user.uid, email=user.email, username=user.username, name=user.name, role=user.role, is_active=user.is_active, created_at=user.created_at)


def signin(data: UserLogin, session: Session) -> Token:
    statement = select(User).where(or_(User.email == data.identifier, User.username == data.identifier))
    user = session.exec(statement).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not pwd_context.verify(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(user_uid=user.uid)
    return Token(access_token=token)


def to_user_read(user: User) -> UserRead:
    return UserRead(uid=user.uid, email=user.email, username=user.username, name=user.name, role=user.role, is_active=user.is_active, created_at=user.created_at)
