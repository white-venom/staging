"""add collection online_routing_deposit_id link

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-18 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    columns = [col['name'] for col in inspector.get_columns('collections')]
    if 'online_routing_deposit_id' not in columns:
        op.add_column(
            'collections',
            sa.Column('online_routing_deposit_id', sa.Uuid(), sa.ForeignKey('bank_deposits.id', ondelete='SET NULL'), nullable=True)
        )

    # Best-effort backfill: link existing retailer collections that had an online
    # component routed to a bank_account to their auto-created online-routing
    # deposit, using the same bank_account_id/staff_id/amount/date match the old
    # code used, so pre-migration pairs get a real link too. Only fills unambiguous
    # 1:1 matches -- ambiguous groups are left null (they fall back to the
    # coincidence-match code path, unchanged from before this migration).
    conn.execute(sa.text("""
        UPDATE collections c
        SET online_routing_deposit_id = bd.id
        FROM denominations cd, bank_deposits bd
        WHERE c.online_routing_deposit_id IS NULL
          AND c.retailer_id IS NOT NULL
          AND c.bank_account_id IS NOT NULL
          AND cd.collection_id = c.id
          AND cd.online_amount > 0
          AND bd.deposit_type = 'portal'
          AND bd.payment_mode = 'online'
          AND bd.staff_id = c.staff_id
          AND bd.bank_account_id = c.bank_account_id
          AND bd.amount = cd.online_amount
          AND bd.deposit_date = c.collection_date
          AND (
            SELECT COUNT(*) FROM bank_deposits bd2
            WHERE bd2.deposit_type = 'portal'
              AND bd2.payment_mode = 'online'
              AND bd2.staff_id = c.staff_id
              AND bd2.bank_account_id = c.bank_account_id
              AND bd2.amount = cd.online_amount
              AND bd2.deposit_date = c.collection_date
          ) = 1
          AND (
            SELECT COUNT(*) FROM collections c2
            JOIN denominations cd2 ON cd2.collection_id = c2.id
            WHERE c2.retailer_id IS NOT NULL
              AND c2.staff_id = c.staff_id
              AND c2.bank_account_id = c.bank_account_id
              AND cd2.online_amount = cd.online_amount
              AND c2.collection_date = c.collection_date
          ) = 1
    """))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    columns = [col['name'] for col in inspector.get_columns('collections')]
    if 'online_routing_deposit_id' in columns:
        op.drop_column('collections', 'online_routing_deposit_id')
