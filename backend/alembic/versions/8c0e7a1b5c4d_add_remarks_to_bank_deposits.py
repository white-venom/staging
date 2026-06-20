"""add remarks to bank deposits

Revision ID: 8c0e7a1b5c4d
Revises: 7b9d2e4f6a8c
Create Date: 2026-06-20 22:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '8c0e7a1b5c4d'
down_revision: Union[str, None] = '7b9d2e4f6a8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bank_deposits',
        sa.Column('remarks', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('bank_deposits', 'remarks')
