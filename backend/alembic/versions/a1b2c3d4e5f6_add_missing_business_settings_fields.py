"""add missing business settings fields

Revision ID: a1b2c3d4e5f6
Revises: 9d1c7f4e8b3a
Create Date: 2026-07-01 12:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9d1c7f4e8b3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('business_settings',
        sa.Column('opening_cash_in_hand', sa.Float(), server_default='0.0', nullable=False)
    )
    op.add_column('business_settings',
        sa.Column('staff_can_change_collection_date', sa.Boolean(), server_default='false', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('business_settings', 'staff_can_change_collection_date')
    op.drop_column('business_settings', 'opening_cash_in_hand')
