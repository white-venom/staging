"""add entry window settings

Revision ID: 7b9d2e4f6a8c
Revises: 6a7f8e9c0b1d
Create Date: 2026-06-19 09:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '7b9d2e4f6a8c'
down_revision: Union[str, None] = '6a7f8e9c0b1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('business_settings',
        sa.Column('edit_window_minutes', sa.Integer(), server_default='5', nullable=False)
    )
    op.add_column('business_settings',
        sa.Column('delete_window_minutes', sa.Integer(), server_default='5', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('business_settings', 'edit_window_minutes')
    op.drop_column('business_settings', 'delete_window_minutes')
