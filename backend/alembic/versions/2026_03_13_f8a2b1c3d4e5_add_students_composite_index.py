"""add students composite index on (user_id, is_active)

Revision ID: f8a2b1c3d4e5
Revises: e375332db6a6
Create Date: 2026-03-13 22:37:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f8a2b1c3d4e5'
down_revision: Union[str, None] = 'e375332db6a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_students_user_active', 'students', ['user_id', 'is_active']
    )


def downgrade() -> None:
    op.drop_index('ix_students_user_active', table_name='students')
