"""make weekly_plans calendar fields nullable for unscheduled state

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-19 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "g7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("weekly_plans", "week_number", existing_type=sa.Integer(), nullable=True)
    op.alter_column("weekly_plans", "year", existing_type=sa.Integer(), nullable=True)
    op.alter_column("weekly_plans", "month", existing_type=sa.Integer(), nullable=True)
    op.alter_column("weekly_plans", "week_of_month", existing_type=sa.Integer(), nullable=True)
    op.alter_column("weekly_plans", "week_range", existing_type=sa.String(50), nullable=True)


def downgrade() -> None:
    # Set any NULLs to defaults before re-applying NOT NULL
    op.execute("UPDATE weekly_plans SET week_number = 0 WHERE week_number IS NULL")
    op.execute("UPDATE weekly_plans SET year = 2026 WHERE year IS NULL")
    op.execute("UPDATE weekly_plans SET month = 1 WHERE month IS NULL")
    op.execute("UPDATE weekly_plans SET week_of_month = 1 WHERE week_of_month IS NULL")
    op.execute("UPDATE weekly_plans SET week_range = '' WHERE week_range IS NULL")

    op.alter_column("weekly_plans", "week_number", existing_type=sa.Integer(), nullable=False)
    op.alter_column("weekly_plans", "year", existing_type=sa.Integer(), nullable=False)
    op.alter_column("weekly_plans", "month", existing_type=sa.Integer(), nullable=False)
    op.alter_column("weekly_plans", "week_of_month", existing_type=sa.Integer(), nullable=False)
    op.alter_column("weekly_plans", "week_range", existing_type=sa.String(50), nullable=False)
