import uuid
import sqlalchemy as sa
from sqlmodel import SQLModel, Field

class Manager(SQLModel, table=True):
    admin_id: uuid.UUID = Field(
        sa_column=sa.Column(
            sa.Uuid(),
            sa.ForeignKey("user.uid"),
            primary_key=True
        )
    )
