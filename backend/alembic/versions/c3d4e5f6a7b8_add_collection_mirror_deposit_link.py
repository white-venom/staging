"""add collection mirror_deposit_id link and baseline uniqueness

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-06 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    columns = [col['name'] for col in inspector.get_columns('collections')]
    if 'mirror_deposit_id' not in columns:
        op.add_column(
            'collections',
            sa.Column('mirror_deposit_id', sa.Uuid(), sa.ForeignKey('bank_deposits.id', ondelete='SET NULL'), nullable=True)
        )

    # Best-effort backfill: link existing staff-to-staff collections to their
    # auto-created mirror deposit using the same staff_id/amount/date match the
    # old code used, so pre-migration pairs get a real link too. Only fills
    # unambiguous 1:1 matches — ambiguous groups are left null (they fall back
    # to the coincidence-match code path, unchanged from before this migration).
    conn.execute(sa.text("""
        UPDATE collections c
        SET mirror_deposit_id = bd.id
        FROM bank_deposits bd
        WHERE c.mirror_deposit_id IS NULL
          AND c.from_staff_id IS NOT NULL
          AND bd.deposit_type = 'staff'
          AND bd.staff_id = c.from_staff_id
          AND bd.recipient_staff_id = c.staff_id
          AND bd.amount = c.total_amount
          AND bd.deposit_date = c.collection_date
          AND (
            SELECT COUNT(*) FROM collections c2
            WHERE c2.from_staff_id = c.from_staff_id
              AND c2.staff_id = c.staff_id
              AND c2.total_amount = c.total_amount
              AND c2.collection_date = c.collection_date
          ) = 1
          AND (
            SELECT COUNT(*) FROM bank_deposits bd2
            WHERE bd2.deposit_type = 'staff'
              AND bd2.staff_id = c.from_staff_id
              AND bd2.recipient_staff_id = c.staff_id
              AND bd2.amount = c.total_amount
              AND bd2.deposit_date = c.collection_date
          ) = 1
    """))

    constraints = [c['name'] for c in inspector.get_unique_constraints('denomination_baselines')]
    if 'uq_denomination_baseline_staff_as_of' not in constraints:
        # De-dupe exact (staff_id, as_of) collisions before adding the constraint,
        # keeping the most recently created row of each colliding pair.
        conn.execute(sa.text("""
            DELETE FROM denomination_baselines a
            USING denomination_baselines b
            WHERE a.staff_id = b.staff_id
              AND a.as_of = b.as_of
              AND a.created_at < b.created_at
        """))
        op.create_unique_constraint(
            'uq_denomination_baseline_staff_as_of',
            'denomination_baselines',
            ['staff_id', 'as_of']
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    constraints = [c['name'] for c in inspector.get_unique_constraints('denomination_baselines')]
    if 'uq_denomination_baseline_staff_as_of' in constraints:
        op.drop_constraint('uq_denomination_baseline_staff_as_of', 'denomination_baselines', type_='unique')

    columns = [col['name'] for col in inspector.get_columns('collections')]
    if 'mirror_deposit_id' in columns:
        op.drop_column('collections', 'mirror_deposit_id')
