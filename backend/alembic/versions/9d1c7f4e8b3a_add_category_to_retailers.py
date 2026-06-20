"""add category to retailers

Revision ID: 9d1c7f4e8b3a
Revises: 8c0e7a1b5c4d
Create Date: 2026-06-21 02:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '9d1c7f4e8b3a'
down_revision: Union[str, None] = '8c0e7a1b5c4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('retailers',
        sa.Column('category', sa.String(length=100), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('retailers', 'category')
