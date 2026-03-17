"""fix weekly_plans unique constraint: calendar week -> curriculum week_number

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-17 15:00:00.000000+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the calendar-based constraint (one plan per real-world calendar week).
    # This was wrong: it causes the upsert to overwrite a plan for curriculum
    # week N when a plan for week N+1 is generated in the same calendar week.
    op.drop_constraint(
        'uq_weekly_plans_user_year_month_week',
        'weekly_plans',
        type_='unique',
    )

    # Add the correct constraint: one plan per curriculum week_number per user.
    # Users can generate all 52 curriculum weeks on the same day without conflict.
    op.create_unique_constraint(
        'uq_weekly_plans_user_week_number',
        'weekly_plans',
        ['user_id', 'week_number'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_weekly_plans_user_week_number', 'weekly_plans', type_='unique')
    op.create_unique_constraint(
        'uq_weekly_plans_user_year_month_week',
        'weekly_plans',
        ['user_id', 'year', 'month', 'week_of_month'],
    )
