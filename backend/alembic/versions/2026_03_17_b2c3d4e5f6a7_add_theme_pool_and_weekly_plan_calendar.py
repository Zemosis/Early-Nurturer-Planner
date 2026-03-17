"""add theme_pool table and calendar columns to weekly_plans

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-17 11:00:00.000000+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Create theme_pool table ────────────────────────────
    op.create_table(
        'theme_pool',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('theme_data', sa.dialects.postgresql.JSONB, nullable=False),
        sa.Column('is_used', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_index('ix_theme_pool_user_active', 'theme_pool',
                    ['user_id', 'is_used'])

    # ── 2. Add new calendar columns to weekly_plans ───────────
    op.add_column('weekly_plans',
                  sa.Column('year', sa.Integer, nullable=True))
    op.add_column('weekly_plans',
                  sa.Column('month', sa.Integer, nullable=True))
    op.add_column('weekly_plans',
                  sa.Column('week_of_month', sa.Integer, nullable=True))

    # Back-fill existing rows with sensible defaults so we can
    # make the columns NOT NULL afterwards.
    op.execute("""
        UPDATE weekly_plans
        SET year = EXTRACT(YEAR FROM created_at)::int,
            month = EXTRACT(MONTH FROM created_at)::int,
            week_of_month = GREATEST(1, ((EXTRACT(DAY FROM created_at)::int - 1) / 7) + 1)
        WHERE year IS NULL
    """)

    op.alter_column('weekly_plans', 'year', nullable=False)
    op.alter_column('weekly_plans', 'month', nullable=False)
    op.alter_column('weekly_plans', 'week_of_month', nullable=False)

    # ── 3. Drop old unique constraint, create new one ─────────
    op.drop_constraint('uq_weekly_plans_user_week', 'weekly_plans', type_='unique')
    op.drop_index('ix_weekly_plans_user_week', table_name='weekly_plans')
    op.create_unique_constraint(
        'uq_weekly_plans_user_year_month_week',
        'weekly_plans',
        ['user_id', 'year', 'month', 'week_of_month'],
    )
    op.create_index('ix_weekly_plans_user_created', 'weekly_plans',
                    ['user_id', 'created_at'])


def downgrade() -> None:
    # Reverse: restore old constraint, drop new columns, drop theme_pool
    op.drop_index('ix_weekly_plans_user_created', table_name='weekly_plans')
    op.drop_constraint('uq_weekly_plans_user_year_month_week', 'weekly_plans',
                       type_='unique')
    op.create_unique_constraint('uq_weekly_plans_user_week', 'weekly_plans',
                                ['user_id', 'week_number'])
    op.create_index('ix_weekly_plans_user_week', 'weekly_plans',
                    ['user_id', 'week_number'])
    op.drop_column('weekly_plans', 'week_of_month')
    op.drop_column('weekly_plans', 'month')
    op.drop_column('weekly_plans', 'year')

    op.drop_index('ix_theme_pool_user_active', table_name='theme_pool')
    op.drop_table('theme_pool')
