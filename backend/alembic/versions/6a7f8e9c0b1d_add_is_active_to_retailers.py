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
    # Add column with a server default of true to handle existing rows
    op.add_column('retailers', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade() -> None:
    op.drop_column('retailers', 'is_active')
