"""add denomination baselines table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-06 06:06:50.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'denomination_baselines' not in inspector.get_table_names():
        op.create_table(
            'denomination_baselines',
            sa.Column('id', sa.Uuid(), primary_key=True),
            sa.Column('staff_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('note_500', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('note_200', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('note_100', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('note_50', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('note_20', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('note_10', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('coins', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
            sa.Column('as_of', sa.DateTime(), nullable=False),
            sa.Column('set_by', sa.Uuid(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_denomination_baselines_staff_id', 'denomination_baselines', ['staff_id'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'denomination_baselines' in inspector.get_table_names():
        op.drop_index('ix_denomination_baselines_staff_id', table_name='denomination_baselines')
        op.drop_table('denomination_baselines')
