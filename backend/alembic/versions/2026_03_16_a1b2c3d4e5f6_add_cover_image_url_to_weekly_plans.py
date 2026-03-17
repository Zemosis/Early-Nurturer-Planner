"""add cover_image_url to weekly_plans

Revision ID: a1b2c3d4e5f6
Revises: f8a2b1c3d4e5
Create Date: 2026-03-16 23:00:00.000000+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f8a2b1c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'weekly_plans',
        sa.Column('cover_image_url', sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('weekly_plans', 'cover_image_url')
