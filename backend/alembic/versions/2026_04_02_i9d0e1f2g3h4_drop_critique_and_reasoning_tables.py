"""drop obsolete critique_history and agent_reasoning_logs tables

Revision ID: i9d0e1f2g3h4
Revises: h8c9d0e1f2g3
Create Date: 2026-04-02 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "i9d0e1f2g3h4"
down_revision: Union[str, None] = "h8c9d0e1f2g3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_critique_thread_round", table_name="critique_history")
    op.drop_index(op.f("ix_critique_history_thread_id"), table_name="critique_history")
    op.drop_table("critique_history")

    op.drop_index("ix_agent_logs_thread_ts", table_name="agent_reasoning_logs")
    op.drop_index(op.f("ix_agent_reasoning_logs_thread_id"), table_name="agent_reasoning_logs")
    op.drop_table("agent_reasoning_logs")


def downgrade() -> None:
    op.create_table(
        "agent_reasoning_logs",
        sa.Column("log_id", sa.UUID(), primary_key=True),
        sa.Column("thread_id", sa.String(255), nullable=False),
        sa.Column("agent_name", sa.String(100), nullable=False),
        sa.Column("internal_monologue", sa.Text(), nullable=False),
        sa.Column("tools_used", JSONB, nullable=True),
        sa.Column("input_summary", sa.Text(), nullable=True),
        sa.Column("output_summary", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_agent_logs_thread_ts", "agent_reasoning_logs", ["thread_id", "timestamp"])
    op.create_index(op.f("ix_agent_reasoning_logs_thread_id"), "agent_reasoning_logs", ["thread_id"])

    op.create_table(
        "critique_history",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("thread_id", sa.String(255), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("architect_proposal", sa.Text(), nullable=False),
        sa.Column("auditor_feedback", sa.Text(), nullable=False),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("accepted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("scores", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_critique_history_thread_id"), "critique_history", ["thread_id"])
    op.create_index("ix_critique_thread_round", "critique_history", ["thread_id", "round_number"])
