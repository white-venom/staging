"""add show_in_online_payment to portals

Revision ID: 5d4e3c2b1a0f
Revises: 3408cd071d9a
Create Date: 2026-06-13 10:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d4e3c2b1a0f'
down_revision: Union[str, None] = '3408cd071d9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column with a server default of false to handle existing rows
    op.add_column('portals', sa.Column('show_in_online_payment', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('portals', 'show_in_online_payment')
