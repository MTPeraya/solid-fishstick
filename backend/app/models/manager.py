from sqlmodel import SQLModel, Field


class Manager(SQLModel, table=True):
    admin_id: str = Field(primary_key=True, foreign_key="user.uid")
