"""add role column to user table

Revision ID: b7c9e1f2a3b4
Revises: a1b2c3d4e5f6
Create Date: 2025-11-27

"""

from alembic import op
import sqlalchemy as sa


revision = 'b7c9e1f2a3b4'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Add role column with a default to backfill existing rows
    op.add_column('user', sa.Column('role', sa.String(), nullable=False, server_default='cashier'))
    # Remove the server default after backfill to match application expectations
    op.alter_column('user', 'role', server_default=None)


def downgrade():
    op.drop_column('user', 'role')

