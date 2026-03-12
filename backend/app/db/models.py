"""
SQLAlchemy ORM models for the Early Nurturer Planner.

Organized into two sections:
  1. Relational models  — users, students, weekly_plans, chat_history
  2. Agentic / vector   — student_embeddings, agent_reasoning_logs,
                           agent_checkpoints, critique_history,
                           vector_store_curriculum

All vector columns use pgvector (1536-dim by default, matching common
embedding models; adjust EMBEDDING_DIM if using a different model).

Frontend TypeScript interfaces used as reference:
  - src/app/types/student.ts   → Student, StudentObservation
  - src/app/types/activity.ts  → DetailedActivity, AgeAdaptation
  - src/app/utils/mockData.ts  → WeekPlan
  - src/app/utils/themeData.ts → ThemeDetail (palette, circleTime, etc.)
"""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.database import Base

# ── Constants ─────────────────────────────────────────────────
EMBEDDING_DIM = 768  # Vertex AI textembedding-gecko output dimension


# ═════════════════════════════════════════════════════════════
# SECTION 1 — Relational Models
# ═════════════════════════════════════════════════════════════


class User(Base):
    """Educator profile, daycare info, and global settings."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    daycare_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(
        String(50), default="educator", nullable=False
    )
    settings: Mapped[dict | None] = mapped_column(
        JSONB, default=dict, doc="User preferences: theme defaults, notification prefs, etc."
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    students: Mapped[list["Student"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    weekly_plans: Mapped[list["WeeklyPlan"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_messages: Mapped[list["ChatHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Student(Base):
    """Child profile — mirrors frontend Student interface.

    Reference: src/app/types/student.ts
    """

    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    birthdate: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    age_months: Mapped[int] = mapped_column(Integer, nullable=False)
    age_group: Mapped[str] = mapped_column(
        Enum("0-12m", "12-24m", "24-36m", name="age_group_enum", create_type=True),
        nullable=False,
    )
    photo_url: Mapped[str | None] = mapped_column(String(512))
    tags: Mapped[list | None] = mapped_column(
        JSONB, default=list, doc='e.g. ["special needs", "new student"]'
    )
    bio: Mapped[str | None] = mapped_column(
        Text, doc="Free-form bio / developmental notes written by the educator."
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="students")
    embeddings: Mapped[list["StudentEmbedding"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_students_user_id", "user_id"),
        Index("ix_students_age_group", "age_group"),
    )


class WeeklyPlan(Base):
    """Generated weekly curriculum plan.

    Stores the theme, color palette, and full activity payload.
    Reference: src/app/utils/mockData.ts (WeekPlan),
               src/app/utils/themeData.ts (ThemeDetail)
    """

    __tablename__ = "weekly_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    week_range: Mapped[str] = mapped_column(String(50), nullable=False, doc="e.g. '2/23 - 2/27'")
    theme: Mapped[str] = mapped_column(String(255), nullable=False)
    theme_emoji: Mapped[str | None] = mapped_column(String(10))
    palette: Mapped[dict | None] = mapped_column(
        JSONB, doc='{"primary": "#7A9B76", "secondary": "#8B6F47", ...}'
    )
    domains: Mapped[list | None] = mapped_column(
        JSONB, doc='["Fine Motor", "Language", "Sensory"]'
    )
    objectives: Mapped[list | None] = mapped_column(
        JSONB, doc='[{"domain": "Fine Motor", "goal": "..."}]'
    )
    circle_time: Mapped[dict | None] = mapped_column(
        JSONB, doc="Letter, color, shape, songs, yoga poses, music/movement videos."
    )
    activities: Mapped[list | None] = mapped_column(
        JSONB, doc="Full activity list per day, including adaptations."
    )
    newsletter: Mapped[dict | None] = mapped_column(
        JSONB, doc='{"professional": "...", "warm": "..."}'
    )
    is_generated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="weekly_plans")

    __table_args__ = (
        UniqueConstraint("user_id", "week_number", name="uq_weekly_plans_user_week"),
        Index("ix_weekly_plans_user_week", "user_id", "week_number"),
    )


class ChatHistory(Base):
    """Persistent chat messages between the educator and the AI assistant."""

    __tablename__ = "chat_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    thread_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        doc="Groups messages into a conversation thread."
    )
    role: Mapped[str] = mapped_column(
        Enum("user", "assistant", "system", name="chat_role_enum", create_type=True),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, default=dict,
        doc="Optional structured data: token counts, model used, etc."
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="chat_messages")

    __table_args__ = (
        Index("ix_chat_history_thread_created", "thread_id", "created_at"),
    )


# ═════════════════════════════════════════════════════════════
# SECTION 2 — Agentic & Vector Models
# ═════════════════════════════════════════════════════════════


class StudentEmbedding(Base):
    """Developmental 'vibes' for each student stored as pgvector embeddings.

    Each row captures a snapshot of a child's developmental profile
    in a particular domain at a point in time. The Personalization Agent
    queries these via cosine similarity to tailor activities.
    """

    __tablename__ = "student_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    domain: Mapped[str] = mapped_column(
        String(100), nullable=False,
        doc="Developmental domain: Sensory, Gross Motor, Language, etc."
    )
    label: Mapped[str | None] = mapped_column(
        String(255), doc="Human-readable description of this embedding snapshot."
    )
    embedding: Mapped[list] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=False,
        doc=f"pgvector column — {EMBEDDING_DIM}-dim float vector."
    )
    source_text: Mapped[str | None] = mapped_column(
        Text, doc="The raw text that was embedded (for provenance)."
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    student: Mapped["Student"] = relationship(back_populates="embeddings")

    __table_args__ = (
        Index("ix_student_embeddings_student_domain", "student_id", "domain"),
    )


class AgentReasoningLog(Base):
    """Chain-of-Thought log for every LangGraph agent invocation.

    Captures the internal monologue and tool calls so the system
    is fully auditable and debuggable.
    """

    __tablename__ = "agent_reasoning_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        doc="LangGraph thread / conversation ID."
    )
    agent_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        doc="Which agent produced this log: architect, auditor, personalizer, etc."
    )
    internal_monologue: Mapped[str] = mapped_column(
        Text, nullable=False,
        doc="The agent's full chain-of-thought reasoning."
    )
    tools_used: Mapped[list | None] = mapped_column(
        JSONB, default=list,
        doc='[{"tool": "search_curriculum", "input": {...}, "output": {...}}]'
    )
    input_summary: Mapped[str | None] = mapped_column(
        Text, doc="Condensed version of what the agent received."
    )
    output_summary: Mapped[str | None] = mapped_column(
        Text, doc="Condensed version of what the agent produced."
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer, doc="Wall-clock time for this reasoning step."
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_agent_logs_thread_ts", "thread_id", "timestamp"),
    )


class AgentCheckpoint(Base):
    """LangGraph checkpoint persistence.

    Stores serialised graph state so long-running or multi-turn
    generations can be resumed from exactly where they left off.
    """

    __tablename__ = "agent_checkpoints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        doc="LangGraph thread ID this checkpoint belongs to."
    )
    checkpoint_ns: Mapped[str] = mapped_column(
        String(255), nullable=False, default="",
        doc="Checkpoint namespace for sub-graph isolation."
    )
    parent_checkpoint_id: Mapped[str | None] = mapped_column(
        String(255), doc="ID of the parent checkpoint (for branching)."
    )
    state: Mapped[dict] = mapped_column(
        JSONB, nullable=False,
        doc="Full serialised LangGraph state dict."
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, default=dict,
        doc="Arbitrary metadata: step count, node name, etc."
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_checkpoints_thread_ns", "thread_id", "checkpoint_ns"),
    )


class CritiqueHistory(Base):
    """Records of internal debates between the Architect and Auditor agents.

    Each row is one round of critique: the original proposal, the
    auditor's feedback, and the revised output (if any).
    """

    __tablename__ = "critique_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        doc="LangGraph thread / conversation context."
    )
    round_number: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1,
        doc="Which critique round (1 = first pass, 2 = revision, …)."
    )
    architect_proposal: Mapped[str] = mapped_column(
        Text, nullable=False,
        doc="The Architect agent's original or revised plan."
    )
    auditor_feedback: Mapped[str] = mapped_column(
        Text, nullable=False,
        doc="The Auditor agent's critique / objections."
    )
    resolution: Mapped[str | None] = mapped_column(
        Text, doc="Final merged output after the debate settled."
    )
    accepted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        doc="Whether the Auditor accepted the proposal."
    )
    scores: Mapped[dict | None] = mapped_column(
        JSONB, doc='{"safety": 9, "developmental_fit": 8, "creativity": 7}'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_critique_thread_round", "thread_id", "round_number"),
    )


class VectorStoreCurriculum(Base):
    """Chunked pedagogy / curriculum PDFs stored as vector embeddings.

    Used by the RAG pipeline to ground agent output in real
    early-childhood-education research and best practices.
    """

    __tablename__ = "vector_store_curriculum"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_document: Mapped[str] = mapped_column(
        String(512), nullable=False,
        doc="Filename or GCS URI of the original PDF."
    )
    chunk_index: Mapped[int] = mapped_column(
        Integer, nullable=False,
        doc="Position of this chunk within the source document."
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False,
        doc="Raw text of the chunk."
    )
    embedding: Mapped[list] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=False,
        doc=f"pgvector column — {EMBEDDING_DIM}-dim float vector."
    )
    token_count: Mapped[int | None] = mapped_column(
        Integer, doc="Number of tokens in this chunk."
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, default=dict,
        doc="Page number, section title, PDF metadata, etc."
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_curriculum_source_chunk", "source_document", "chunk_index"),
    )
