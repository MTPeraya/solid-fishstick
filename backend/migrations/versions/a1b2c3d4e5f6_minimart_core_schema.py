"""minimart core schema (single file)

Revision ID: a1b2c3d4e5f6
Revises: None
Create Date: 2025-11-26

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision = 'a1b2c3d4e5f6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'membershiptier',
        sa.Column('rank_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('min_spent', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('max_spent', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('benefits', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.CheckConstraint('(max_spent IS NULL) OR (max_spent > min_spent)'),
        sa.CheckConstraint('discount_rate >= 0 AND discount_rate <= 100'),
        sa.CheckConstraint('min_spent >= 0'),
        sa.PrimaryKeyConstraint('rank_name')
    )

    op.create_table(
        'promotion',
        sa.Column('promotion_id', sa.Integer(), nullable=False),
        sa.Column('promotion_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('discount_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('discount_value', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.CheckConstraint("discount_type IN ('PERCENTAGE','FIXED')"),
        sa.CheckConstraint('discount_value > 0'),
        sa.CheckConstraint('end_date >= start_date'),
        sa.PrimaryKeyConstraint('promotion_id')
    )

    op.create_table(
        'user',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('username', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('uid', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('hashed_password', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)
    op.create_unique_constraint(None, 'user', ['username'])
    op.create_unique_constraint(None, 'user', ['uid'])

    op.create_table(
        'manager',
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['user.id']),
        sa.PrimaryKeyConstraint('admin_id')
    )

    op.create_table(
        'cashier',
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('position', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['user.id']),
        sa.PrimaryKeyConstraint('employee_id')
    )

    op.create_table(
        'member',
        sa.Column('member_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('phone', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('points_balance', sa.Integer(), nullable=False),
        sa.Column('total_spent', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('membership_rank', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('registration_date', sa.Date(), nullable=False),
        sa.CheckConstraint('discount_rate >= 0 AND discount_rate <= 100'),
        sa.CheckConstraint('points_balance >= 0'),
        sa.CheckConstraint('total_spent >= 0'),
        sa.ForeignKeyConstraint(['membership_rank'], ['membershiptier.rank_name']),
        sa.PrimaryKeyConstraint('member_id')
    )
    op.create_index(op.f('ix_member_phone'), 'member', ['phone'], unique=True)

    op.create_table(
        'product',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('barcode', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('brand', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('cost_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('selling_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('stock_quantity', sa.Integer(), nullable=False),
        sa.Column('min_stock', sa.Integer(), nullable=False),
        sa.Column('promotion_id', sa.Integer(), nullable=True),
        sa.CheckConstraint('min_stock > 0'),
        sa.CheckConstraint('selling_price >= cost_price'),
        sa.CheckConstraint('stock_quantity >= 0'),
        sa.ForeignKeyConstraint(['promotion_id'], ['promotion.promotion_id']),
        sa.PrimaryKeyConstraint('product_id')
    )
    op.create_index(op.f('ix_product_barcode'), 'product', ['barcode'], unique=True)

    op.create_table(
        'transaction',
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('transaction_date', sa.DateTime(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=True),
        sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('product_discount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('membership_discount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('payment_method', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.CheckConstraint("payment_method IN ('Cash','Card','QR Code')"),
        sa.CheckConstraint('membership_discount >= 0'),
        sa.CheckConstraint('product_discount >= 0'),
        sa.CheckConstraint('subtotal >= 0'),
        sa.CheckConstraint('total_amount = subtotal - membership_discount'),
        sa.CheckConstraint('total_amount >= 0'),
        sa.ForeignKeyConstraint(['employee_id'], ['cashier.employee_id']),
        sa.ForeignKeyConstraint(['member_id'], ['member.member_id']),
        sa.PrimaryKeyConstraint('transaction_id')
    )

    op.create_table(
        'transactionitem',
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('line_total', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.CheckConstraint('discount_amount >= 0'),
        sa.CheckConstraint('line_total = (quantity * unit_price) - discount_amount'),
        sa.CheckConstraint('line_total >= 0'),
        sa.CheckConstraint('quantity > 0'),
        sa.CheckConstraint('unit_price >= 0'),
        sa.ForeignKeyConstraint(['product_id'], ['product.product_id']),
        sa.ForeignKeyConstraint(['transaction_id'], ['transaction.transaction_id']),
        sa.PrimaryKeyConstraint('transaction_id', 'product_id')
    )


def downgrade():
    op.drop_table('transactionitem')
    op.drop_table('transaction')
    op.drop_index(op.f('ix_product_barcode'), table_name='product')
    op.drop_table('product')
    op.drop_index(op.f('ix_member_phone'), table_name='member')
    op.drop_table('member')
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_table('cashier')
    op.drop_table('manager')
    op.drop_table('user')
    op.drop_table('promotion')
    op.drop_table('membershiptier')
