from sqlmodel import SQLModel, Field


class Manager(SQLModel, table=True):
    admin_uid: str = Field(primary_key=True, foreign_key="user.uid")
