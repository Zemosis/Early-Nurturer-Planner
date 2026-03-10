# Development Log: Early Nurturer Planner

## Phase 1: Infrastructure & Environment Setup
**Status:** Complete

### Key Accomplishments
* **Repository Initialization:** Detached the cloned frontend repository from its original git history and initialized a fresh, proprietary project structure.
* **GCP Project Provisioning:** * Enabled essential Google Cloud APIs: Compute, SQL Admin, Storage, and Vertex AI.
    * Provisioned a PostgreSQL Cloud SQL instance (`nurture-postgres`). Upgraded the tier to `db-g1-small` to support required AI vector operations.
    * Created a Cloud Storage bucket for storing AI-generated PDFs and assets.
* **Agentic AI Memory Setup:** Successfully connected to the Cloud SQL instance and enabled the `pgvector` extension. This is critical for storing the child developmental "vibes" and enabling the Personalization Agent.
* **Security & Authentication:** * Created the `nurture-backend-sa` service account with Vertex AI and Storage Admin roles.
    * Downloaded and securely gitignored the JSON credential keys.
* **Networking Solutions:** * Created a custom `scripts/update-db-ip.sh` bash script to easily whitelist changing dynamic IP addresses (e.g., when switching between campus Wi-Fi and home networks).
    * Configured the Cloud SQL Auth Proxy as a permanent solution to bypass IP whitelisting entirely.
* **Local Backend Scaffolding:** Set up the isolated Python virtual environment (`venv`) and configured the `.env` file with the appropriate async database connection strings (`postgresql+asyncpg`) and Google Cloud credentials.

### Issues Encountered & Fixes

* **`gcloud sql connect` failure** The Cloud SQL Auth Proxy binary is not installable via `gcloud components install` on Fedora (package-manager-based gcloud installs don't support it). **Fix:** Rewrote `scripts/gcp-phase1-setup.sh` to bypass the proxy entirely — temporarily authorizes the user's public IP, connects directly via `psql` with `PGPASSWORD`, enables pgvector, then revokes the IP authorization. Added `psql` and `curl` as pre-flight checks.

---

## Phase 2: Database Schema & SQLAlchemy Models
**Status:** Complete

### Key Accomplishments

* **Async Database Engine (`backend/app/db/database.py`):**
    * Created an asynchronous SQLAlchemy 2.0 engine backed by `asyncpg`.
    * Loads `DATABASE_URL` from `.env` via `pydantic-settings` (`config.py`).
    * Provides `get_session()` async generator for use as a FastAPI `Depends()` dependency with auto-commit/rollback.
    * Connection pool configured: `pool_size=5`, `max_overflow=10`, `pool_pre_ping=True`.

* **Relational Models (`backend/app/db/models.py`):**
    * `users` — Educator profile with `email`, `full_name`, `daycare_name`, `role`, `settings` (JSONB), cascading relationships to students, plans, and chat.
    * `students` — Child profiles with `name`, `birthdate`, `age_months`, `age_group` (Postgres enum: `0-12m`, `12-24m`, `24-36m`), `bio`, `tags` (JSONB). Mapped from frontend `Student` interface in `src/app/types/student.ts`.
    * `weekly_plans` — Generated curriculum plans storing `theme`, `theme_emoji`, `palette` (JSONB hex colors), `domains`, `objectives`, `circle_time`, `activities`, and `newsletter` — all as JSONB. Mapped from frontend `WeekPlan` and `ThemeDetail` interfaces.
    * `chat_history` — Persistent user/assistant/system messages with `thread_id` grouping and timestamp indexing.

* **Agentic & Vector Models (same file):**
    * `student_embeddings` — pgvector `Vector(768)` column linked to `students` for storing developmental "vibes" per domain. Dimension 768 matches Vertex AI `textembedding-gecko`.
    * `agent_reasoning_logs` — Chain-of-Thought audit: `thread_id`, `agent_name`, `internal_monologue` (Text), `tools_used` (JSONB), `duration_ms`, `timestamp`.
    * `agent_checkpoints` — LangGraph state persistence: `thread_id`, `checkpoint_ns`, `state` (JSONB), `parent_checkpoint_id` for branching.
    * `critique_history` — Architect ↔ Auditor debate records: `round_number`, `architect_proposal`, `auditor_feedback`, `resolution`, `accepted`, `scores` (JSONB).
    * `vector_store_curriculum` — RAG pipeline: chunked pedagogy PDFs with pgvector `Vector(768)` embeddings, `source_document`, `chunk_index`, `content`, `token_count`, `metadata` (JSONB).

* **Alembic Migrations (`backend/alembic/`):**
    * Initialized Alembic with full async support — `alembic/env.py` uses `async_engine_from_config` + `asyncio.run()`.
    * `DATABASE_URL` injected dynamically from `.env`; no credentials in `alembic.ini`.
    * `script.py.mako` template pre-imports `pgvector.sqlalchemy.Vector` for all future migrations.
    * Generated and applied initial migration: `2026_03_09_5f368ee0298a_initial_schema_with_pgvector.py`.

* **Dependencies (`backend/requirements.txt`):**
    * Added `alembic>=1.14.0` to the existing stack (fastapi, asyncpg, sqlalchemy, pgvector, google-cloud-*, langgraph, langchain).

### Issues Encountered & Fixes

* **Alembic `pgvector` NameError:** Alembic's autogenerate rendered Vector columns as the fully-qualified `pgvector.sqlalchemy.vector.VECTOR(dim=768)` instead of using the imported `Vector` class. This caused `NameError: name 'pgvector' is not defined` when running `alembic upgrade head`. **Fix:** Replaced both occurrences in the migration file with `Vector(768)`. **Prevention:** The `script.py.mako` template now includes `from pgvector.sqlalchemy import Vector` so future autogenerated migrations will have the import available — but always review autogenerated files for this pattern before applying.

### Architecture Notes

* **Embedding Dimension:** `EMBEDDING_DIM = 768` is set as a constant at the top of `models.py`. If switching to a different embedding model (e.g., OpenAI `text-embedding-3-small` at 1536-dim), update this constant and generate a new migration.
* **JSONB Strategy:** Rich nested data (activities, circle_time, palette, objectives) is stored as JSONB rather than normalized tables. This keeps the schema manageable and matches how the frontend consumes the data. Can be normalized later if query patterns demand it.
* **UUID Primary Keys:** All tables use `UUID` primary keys for distributed-safe ID generation.

---

## Phase 3: Agent Tools, Schemas & AI Integration
**Status:** Complete

### Key Accomplishments

* **Database Seeding (`backend/scripts/seed_db.py`):**
    * Created an idempotent seed script that inserts mock data for development.
    * Inserts 1 User (Sarah Thompson, Little Sprouts Learning Center), 4 Students (Emma, Liam, Sophia, Noah — ages 13–30 months across `12-24m` and `24-36m` groups), and 8 StudentEmbeddings (2 per student: Sensory + Gross Motor domains, random 768-dim vectors via `numpy` with deterministic `rng(seed=42)`).
    * Checks for existing data before inserting — safe to re-run.

* **Pydantic Schemas (`backend/app/agents/schemas.py`):**
    * Created structured output schemas matching the frontend `ThemeDetail` TypeScript interface (`src/app/utils/themeData.ts`).
    * Nested models: `ThemePalette` (4 hex colors), `ThemeCircleTime` (greeting, counting, letter examples, movement, color), `ThemeActivityExample` (title, description, materials), `ThemeEnvironment` (description, visual elements, ambiance).
    * Top-level `ThemeSchema` includes `id`, `name`, `emoji`, `letter`, `shape`, `mood`, `atmosphere`, `visual_direction`, plus all nested models.
    * Every field uses `Field(description=...)` so Gemini understands each attribute during structured generation. List fields use `min_length`/`max_length` constraints.

* **Agent Tools (`backend/app/agents/tools.py`):**
    * `fetch_student_context(user_id)` — Async function that queries the `students` table for all active students belonging to an educator. Returns a formatted, LLM-consumable string with name, age, group, bio, and tags per child. Handles the empty-roster edge case.
    * `generate_theme_options(student_context, count=5)` — Calls Vertex AI / Gemini (`gemini-2.5-flash`) via the `google-genai` SDK. Uses `response_mime_type="application/json"` + `response_schema=list[ThemeSchema]` to guarantee structured JSON output. System prompt instructs the AI to act as an expert Montessori/ECE educator. Response is validated through Pydantic `TypeAdapter`.
    * `query_pedagogy(query_text)` — Scaffolded RAG search tool. Returns keyword-matched mock pedagogy advice (fine motor, sensory, gross motor, language) plus a generic fallback. Contains clearly marked TODO blocks for Phase 4: Vertex AI embedding call (`text-embedding-004`) and pgvector cosine similarity query against `vector_store_curriculum`.

* **Gemini Client Setup:**
    * Module-level `genai.Client(vertexai=True)` initialized with `GCP_PROJECT_ID` and `VERTEX_AI_LOCATION` from `config.settings`.
    * Model set to `gemini-2.5-flash` — best balance of speed, cost, and structured output quality.

* **Dependencies (`backend/requirements.txt`):**
    * Added `numpy>=1.26.0` (vector generation, future embedding work).
    * Added `google-genai>=1.0.0` (Vertex AI / Gemini structured output SDK).

### Architecture Notes

* **Structured Output Strategy:** Using `response_schema` with Pydantic models forces Gemini to output valid JSON matching the frontend types exactly. No post-processing or free-text parsing required.
* **Tool Separation:** Each tool is a standalone async function — no class dependencies. This makes them easy to bind to LangGraph `ToolNode` or call directly from any agent node.
* **Mock-first RAG:** `query_pedagogy()` works with mock data now so the full agent pipeline can be tested end-to-end before real PDFs are ingested in Phase 4.
* **Model Choice:** `gemini-2.5-flash` for theme/activity generation; `gemini-2.5-pro` reserved for future Auditor agent (critique loop) where deeper reasoning justifies the cost.

### Next Steps
* Phase 4: Ingest pedagogy PDFs into `vector_store_curriculum`, implement real embedding + pgvector cosine search in `query_pedagogy()`, and build the LangGraph agent graph with Architect ↔ Auditor critique loop.