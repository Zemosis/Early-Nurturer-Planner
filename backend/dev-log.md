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

---

## Phase 4: LangGraph Multi-Agent Brain
**Status:** Complete
**Date:** March 11, 2026

### Key Accomplishments

* **Auditor & Curriculum Schemas (`backend/app/agents/schemas.py`):**
    * `AuditScores` — Nested rubric model with `safety`, `developmental_fit`, and `creativity` scores (1–10, enforced with `ge`/`le` constraints).
    * `AuditResultSchema` — Structured Auditor output: `accepted` (bool), `critique` (str), `safety_concerns` (list[str]), `scores` (AuditScores). Maps directly to the `critique_history` DB table.
    * `ObjectiveSchema` — Domain + goal pair for weekly objectives.
    * `AgeAdaptationSchema` — Per-activity age adaptation with `Literal["0-12m", "12-24m", "24-36m"]` enum, description, and modifications list. Mirrors frontend `AgeAdaptation` interface.
    * `ActivitySchema` — Full activity model merging `WeekPlan.activities` (simple) with `DetailedActivity` (rich). Includes `id`, `day`, `title`, `domain`, `duration`, `description`, `theme_connection`, `materials`, `safety_notes`, `adaptations`, and `reflection_prompts`.
    * `SongSchema` — Circle time song with title, script (lyrics), and duration.
    * `YogaPoseSchema` — Toddler yoga pose with name, benefits, and hold duration.
    * `CircleTimeSchema` — Full circle-time plan: letter, color, shape, counting_to, greeting/goodbye songs, yoga poses, read-aloud recommendation, and discussion prompt. Media URLs excluded from AI generation (curated separately).
    * `DailyPlanSchema` — Single day's schedule with `day`, `focus_domain`, and 1–4 activities.
    * `NewsletterSchema` — Parent newsletter with `welcome_message`, `learning_goals`, `home_connection`, plus `professional_version` and `warm_version` text.
    * `WeekPlanSchema` — Master curriculum model: `id`, `week_number`, `week_range`, `theme`, `theme_emoji`, `palette`, `domains`, `objectives`, `circle_time`, exactly 5 `daily_plans`, and `newsletter`.

* **Graph State (`backend/app/agents/state.py`):**
    * `PlannerState` TypedDict with `total=False` — each node returns only the keys it modifies.
    * Inputs: `user_id`, `thread_id`, `selected_theme`, `week_number`, `week_range`.
    * Context: `student_context`, `pedagogy_context` (populated by fetch_context node).
    * Agent outputs: `draft_plan`, `audit_result`, `personalized_plan`.
    * Control: `iteration_count` (max 3), `error`.

* **Curriculum Architect (`backend/app/agents/architect.py`):**
    * Async `curriculum_architect(state) -> dict` LangGraph node.
    * System prompt: senior Montessori curriculum designer persona with structural rules (5 days, adaptations, safety_notes, circle time, newsletter).
    * User prompt includes theme JSON, week details, student roster, and pedagogy context.
    * Critique loop: if `iteration_count > 0` and `audit_result` exists, appends `⚠️ REVISION REQUIRED` section with auditor's critique and specific safety concerns.
    * Gemini config: `response_schema=WeekPlanSchema`, `temperature=0.9`.
    * Returns `{"draft_plan": ..., "iteration_count": n+1, "error": None}`.

* **Safety Auditor (`backend/app/agents/auditor.py`):**
    * Async `safety_auditor(state) -> dict` LangGraph node.
    * System prompt: rigorous safety compliance officer persona evaluating 3 criteria — physical safety (choking hazards, toxic materials), developmental appropriateness (age fit, duration), thematic coherence.
    * Decision rules: `safety < 7` → must reject, `developmental_fit < 6` → must reject.
    * Includes `draft_plan` (serialised JSON), `student_context`, and `selected_theme` in prompt.
    * Gemini config: `response_schema=AuditResultSchema`, `temperature=0.3` (deterministic judgment).
    * Does NOT mutate `iteration_count`.
    * Guard: returns pre-built rejection if `draft_plan` is None.

* **Personalizer (`backend/app/agents/personalizer.py`):**
    * Async `personalize_plan(state) -> dict` LangGraph node.
    * System prompt: master Montessori guide with strict constraints — MUST NOT change core activities, materials, or safety_notes. MAY ONLY enrich `adaptations`, `description`, `reflection_prompts`, and `theme_connection` with child-specific references.
    * Includes auditor praise in prompt to reinforce what NOT to touch.
    * Gemini config: `response_schema=WeekPlanSchema`, `temperature=0.5`.
    * Guards: rejects if `draft_plan` is None or `audit_result.accepted` is False.

* **Graph Wiring (`backend/app/agents/graph.py`):**
    * `fetch_context_node(state)` — Calls `fetch_student_context()` and `query_pedagogy()` to populate state before the Architect runs.
    * `save_plan_node(state)` — Persists to Postgres:
        * `personalized_plan` → `weekly_plans` table (flattens `daily_plans` → `activities` column, converts `user_id` str → UUID).
        * `audit_result` → `critique_history` table (`iteration_count` → `round_number`, draft JSON → `architect_proposal`).
        * Pipeline summary → `agent_reasoning_logs` table.
    * `route_auditor(state) -> str` — Conditional edge: `"personalize"` if accepted / iteration cap reached / error present; `"revise"` otherwise.
    * `build_planner_graph()` — Compiles the full `StateGraph`:
        ```
        START → fetch_context → architect → auditor
                       ↑                       ↓
                       └──── (revise) ←── route_auditor
                                              ↓
                                        (personalize)
                                              ↓
                                         personalizer → save → END
        ```

### Architecture Notes

* **Temperature Strategy:** Architect (0.9, creative) → Auditor (0.3, strict) → Personalizer (0.5, balanced). Each temperature matches the agent's role.
* **Structured Output Everywhere:** All three agents use `response_schema` with Pydantic models — zero free-text parsing, guaranteed JSON conformance.
* **Iteration Cap:** Maximum 3 Architect passes before force-accepting. Prevents infinite critique loops while allowing meaningful revision.
* **Error Resilience:** `route_auditor` checks for errors and routes forward to avoid infinite error loops. Save node falls back to `draft_plan` if personalization failed.
* **DB Mapping:** `WeekPlanSchema.daily_plans` (5 DailyPlanSchema objects) is flattened to a single activities list for the `weekly_plans.activities` JSONB column.

### Files Created / Modified

| File | Action |
|---|---|
| `backend/app/agents/schemas.py` | Extended with 12 new Pydantic models |
| `backend/app/agents/state.py` | Created — `PlannerState` TypedDict |
| `backend/app/agents/architect.py` | Created — Curriculum Architect node |
| `backend/app/agents/auditor.py` | Created — Safety Auditor node |
| `backend/app/agents/personalizer.py` | Created — Personalizer node |
| `backend/app/agents/graph.py` | Created — Graph wiring, save node, routing |

### Next Steps
* Phase 5: Create FastAPI endpoints to invoke `build_planner_graph()`, expose theme selection and plan generation to the frontend.
* Implement real embedding + pgvector cosine search in `query_pedagogy()` (replace mock data).
* Ingest pedagogy PDFs into `vector_store_curriculum`.
* Add LangGraph checkpoint persistence using `agent_checkpoints` table for resume-on-failure.

---

## Phase 5: FastAPI Endpoints
**Status:** Complete
**Date:** March 11, 2026

### Key Accomplishments

* **Themes Router (`backend/app/api/routers/themes.py`):**
    * `POST /api/themes/generate` — Accepts `user_id`, `child_ages`, `theme_count`. Fetches student context via `fetch_student_context()`, then calls `generate_theme_options()` to produce AI-generated themes. Returns the list of `ThemeSchema` objects directly.
    * Error handling returns `500` with descriptive `detail` on failure.

* **Planner Router (`backend/app/api/routers/planner.py`):**
    * `POST /api/planner/generate` — Accepts `user_id`, `selected_theme`, `week_number`, `week_range`. Builds and invokes the full LangGraph pipeline via `build_planner_graph()`. Extracts `personalized_plan` (or falls back to `draft_plan`) from final state. Returns `{"status": "ok", "plan": {...}}`.
    * Comprehensive logging: logs final state keys, presence of plan/error, and full error detail on failure.
    * Error handling returns `500` with pipeline error message or generic fallback.

* **FastAPI App (`backend/main.py`):**
    * Registered both routers with `app.include_router()`.
    * Added `logging.basicConfig(level=logging.INFO, format=...)` for visibility of agent pipeline logs in terminal.
    * CORS middleware configured for `localhost:5173` / `localhost:5174` (Vite dev server).

### Issues Encountered & Fixes

* **Gemini 400 INVALID_ARGUMENT on `WeekPlanSchema`:** The deeply nested schema (4 levels: `WeekPlanSchema` → `DailyPlanSchema` → `ActivitySchema` → `AgeAdaptationSchema`) with `ge`/`le`, `min_length`/`max_length` constraints and `Literal` types exceeded Gemini's structured output complexity limit. The shallower `ThemeSchema` worked fine.
    * **Fix:** Stripped all numeric bounds (`ge`, `le`), array length constraints (`min_length`, `max_length`), and replaced all `Literal["0-12m", ...]` types with plain `str` in `WeekPlanSchema` and its nested models. Moved expected values into `Field(description=...)` instead. Confirmed 200 OK with valid, complete plan output.
    * **Lesson learned:** Gemini's `response_schema` rejects schemas with too many constraint states. Keep deep schemas constraint-free; enforce validation post-generation if needed.

* **Silent pipeline failures:** Initial 500 errors gave no useful diagnostic info.
    * **Fix:** Added structured logging to all 6 pipeline nodes (`fetch_context_node`, `curriculum_architect`, `safety_auditor`, `personalize_plan`, `save_plan_node`, `route_auditor`). Each logs entry/exit, Gemini call start/completion, validation results, and full error traces with `traceback.format_exc()`.

### Files Created / Modified

| File | Action |
|---|---|
| `backend/app/api/routers/themes.py` | Created — Themes generation endpoint |
| `backend/app/api/routers/planner.py` | Created — Planner pipeline endpoint |
| `backend/main.py` | Modified — Router registration, logging, CORS |
| `backend/app/agents/schemas.py` | Modified — Removed constraints for Gemini compatibility |
| `backend/app/agents/architect.py` | Modified — Added logging |
| `backend/app/agents/auditor.py` | Modified — Added logging |
| `backend/app/agents/personalizer.py` | Modified — Added logging |
| `backend/app/agents/graph.py` | Modified — Added logging to fetch, save, route nodes |

---

## Phase 6: Frontend ↔ Backend Integration
**Status:** In-Progress 
**Date:** March 11, 2026

### Key Accomplishments

* **Vite Dev Proxy (`vite.config.ts`):**
    * Added `server.proxy` config: all `/api/*` requests forward to `http://127.0.0.1:8000` with `changeOrigin: true`. Eliminates CORS issues during development.

* **API Client (`src/app/utils/api.ts`):**
    * `generateThemes(params?)` — `POST /api/themes/generate` with default `user_id`, `child_ages`, `theme_count`. Returns raw theme array.
    * `generatePlan(params)` — `POST /api/planner/generate` with `selected_theme`, `week_number`, `week_range`. Returns `{status, plan}`.
    * Both functions include error extraction from JSON response body with fallback to `statusText`.
    * Hardcoded `DEFAULT_USER_ID` (`83b58b5f-...`) matches the seeded educator in the database.

* **Response Transformers (`src/app/utils/apiTransformers.ts`):**
    * `transformApiThemeToThemeDetail(api) → ThemeDetail` — Converts snake_case backend theme → camelCase frontend interface. Maps `palette`, `circle_time`, `activities`, and `environment` nested objects.
    * `transformApiPlanToWeekPlan(api) → WeekPlan` — Converts snake_case backend plan → camelCase frontend interface. Key transformations:
        * Flattens `daily_plans[].activities[]` → flat `activities[]` array (backend nests by day; frontend expects flat list).
        * Maps `adaptations[].age_group` → `adaptations[].age` and `adaptations[].description` → `adaptations[].content`.
        * Injects static data that the AI doesn't generate: yoga video URLs (mapped by pose name), music & movement videos (3 hardcoded entries with full `guidance` objects), greeting/goodbye song video URLs.
    * `DEFAULT_YOGA_VIDEO_MAP` — 10 pose-name → YouTube embed URL mappings.
    * `DEFAULT_MUSIC_MOVEMENT_VIDEOS` — 3 complete video objects (Freeze Dance, Head Shoulders, If You're Happy) with `howToConduct`, `whatToModel`, and `developmentFocus` guidance.

* **Planner Context (`src/app/contexts/PlannerContext.tsx`):**
    * New React context providing: `currentPlan` (`WeekPlan | null`), `themeOptions` (`ThemeDetail[]`), `isGenerating`, `error`.
    * `<PlannerProvider>` wraps the entire app in `App.tsx` (outermost provider).

* **Theme Context Updates (`src/app/contexts/ThemeContext.tsx`):**
    * Added `setThemeFromDetail(detail: ThemeDetail)` — applies an arbitrary `ThemeDetail` as current theme (for AI-generated themes not in `themeLibrary`).
    * Added `registerDynamicThemes(themes: ThemeDetail[])` — stores AI-generated themes so `previewTheme()` and `setTheme()` can look them up by ID.
    * Internal `findTheme()` helper searches both `themeLibrary` and `dynamicThemes`.

* **GenerateWeekModal Rewrite (`src/app/components/GenerateWeekModal.tsx`):**
    * Replaced mock `getRandomThemes()` with real API flow. Four stages:
        1. **`generating-themes`** — Spinner while `generateThemes()` API call runs. Message: "AI is crafting personalised themes for your classroom."
        2. **`selection`** — Theme grid with shuffle button (calls `generateThemes()` again, with loading spinner on the button). Raw API theme objects stored in parallel array for sending back to planner.
        3. **`generating-plan`** — Spinner while `generatePlan()` runs with the selected raw theme. Message: "Architect → Auditor → Personalizer pipeline is running. This may take up to 2 minutes."
        4. **`error`** — Red alert icon with error message and "Try Again" button that restarts from theme generation.
    * On success: calls `setCurrentPlan(plan)` and `onComplete()` to navigate to `/week/1`.
    * Abort handling via `useRef` to prevent state updates on unmounted component.

* **Dashboard Updates (`src/app/pages/Dashboard.tsx`):**
    * Replaced hardcoded `currentWeek` import with `usePlanner().currentPlan`.
    * Both mobile and desktop layouts now conditionally render the "current week" card based on `currentPlan` being non-null.
    * Removed `useEffect` that applied theme from mock data on mount.

* **WeeklyPlan Updates (`src/app/pages/WeeklyPlan.tsx`):**
    * Uses `usePlanner().currentPlan` as primary data source, falls back to `generateWeekPlan(1)` mock data if no AI plan exists.
    * Removed `useParams` dependency (plan comes from context, not URL param).
    * Removed `useEffect` that looked up theme by name from static library.

### Architecture Notes

* **Data flow:** `GenerateWeekModal` → `api.generateThemes()` → user picks theme → `api.generatePlan()` → `apiTransformers.transformApiPlanToWeekPlan()` → `PlannerContext.setCurrentPlan()` → `Dashboard` and `WeeklyPlan` consume via `usePlanner()`.
* **Static data injection:** The AI generates activity content but not media URLs. The transformer layer injects curated YouTube embeds for yoga poses, music videos, and songs. This keeps the AI focused on curriculum while ensuring media links are always valid.
* **Graceful fallback:** `WeeklyPlan` falls back to mock data so the UI is never empty, even without a running backend.
* **Theme system:** AI-generated themes are registered as "dynamic themes" in ThemeContext so the existing preview/selection infrastructure works without changes to `ThemeSelectionGrid` or `ThemeSelectionHeader`.

### Files Created / Modified

| File | Action |
|---|---|
| `src/app/utils/api.ts` | Created — API client |
| `src/app/utils/apiTransformers.ts` | Created — Backend → frontend transformers |
| `src/app/contexts/PlannerContext.tsx` | Created — Plan state management |
| `vite.config.ts` | Modified — Dev proxy |
| `src/app/App.tsx` | Modified — PlannerProvider wrapper |
| `src/app/contexts/ThemeContext.tsx` | Modified — Dynamic theme support |
| `src/app/components/GenerateWeekModal.tsx` | Modified — Full API integration rewrite |
| `src/app/pages/Dashboard.tsx` | Modified — PlannerContext consumption |
| `src/app/pages/WeeklyPlan.tsx` | Modified — PlannerContext consumption |

### Next Steps
* End-to-end testing with both servers running.
* Implement real embedding + pgvector cosine search in `query_pedagogy()` (replace mock data).
* Ingest pedagogy PDFs into `vector_store_curriculum`.
* Add LangGraph checkpoint persistence using `agent_checkpoints` table for resume-on-failure.
* Add plan persistence to localStorage or DB so plans survive page refresh.