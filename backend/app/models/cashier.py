from sqlmodel import SQLModel, Field


class Cashier(SQLModel, table=True):
    employee_uid: str = Field(primary_key=True, foreign_key="user.uid")
    position: str
