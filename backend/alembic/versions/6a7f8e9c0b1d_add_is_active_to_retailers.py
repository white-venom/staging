"""add is_active to retailers

Revision ID: 6a7f8e9c0b1d
Revises: 5d4e3c2b1a0f
Create Date: 2026-06-13 12:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a7f8e9c0b1d'
down_revision: Union[str, None] = '5d4e3c2b1a0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Inspect columns first to prevent duplicate column errors
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c['name'] for c in inspector.get_columns('retailers')]
    if 'is_active' not in columns:
        op.add_column('retailers', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade() -> None:
    # Check if exists before drop
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c['name'] for c in inspector.get_columns('retailers')]
    if 'is_active' in columns:
        op.drop_column('retailers', 'is_active')
