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

---

## Phase 7: YouTube Video Integration & Enricher Agent
**Status:** In-Progress 
**Date:** March 11, 2026

### Problem Statement

The frontend was injecting **static, hardcoded** YouTube URLs for songs and yoga poses via `apiTransformers.ts`. AI-generated song titles (e.g. "Hello, Little Garden Friends") had no corresponding real video. Titles, lyrics, durations, and yoga pose names displayed in the UI were entirely fictional — they didn't match any real YouTube content.

### Key Accomplishments

* **YouTube Data API v3 Integration (`backend/app/agents/tools.py`):**
    * Added `httpx` dependency and `YOUTUBE_API_KEY` to `config.py` / `.env`.
    * `search_youtube_video(query, video_category_id?)` — Async function that:
        1. Hits `youtube/v3/search` with `safeSearch=strict` to find a video.
        2. Hits `youtube/v3/videos?part=contentDetails` to fetch real duration (ISO 8601).
        3. Returns full metadata dict: `{embed_url, title, duration, duration_seconds, thumbnail}`.
    * `_parse_iso8601_duration(iso)` — Converts `PT3M8S` → `("3:08", 188)`.
    * `_clean_youtube_title(raw)` — Strips channel suffixes (e.g. `| The Singing Walrus`), keeps first meaningful segment.

* **Dedicated YouTube Enricher Node (`backend/app/agents/youtube_enricher.py`):**
    * New LangGraph node that runs **once** after the Auditor loop, before the Personalizer.
    * **Smarter query construction:** Searches by type + theme keywords instead of AI's fictional titles:
        * Greeting: `"good morning hello circle time song toddlers kids {theme}"`
        * Goodbye: `"goodbye song circle time toddlers kids {theme}"`
        * Yoga: Maps AI creative names → standard poses via `_YOGA_POSE_MAP` (e.g. "seed"→"seed to tree", "butterfly"→"butterfly pose"), then `"{standard_pose} yoga for kids toddlers"`.
    * **Metadata overwrite:** After finding real YouTube videos, **overwrites** the AI-generated `title` and `duration` with actual video metadata. Injects `youtube_url` embed URL.
    * Uses `asyncio.gather()` for concurrent searches (all songs + yoga poses in parallel).
    * Saves API quota: runs only once on the final accepted plan, not on every Architect iteration.

* **Graph Rewiring (`backend/app/agents/graph.py`):**
    * Removed inline YouTube enrichment from `architect.py`.
    * New pipeline:
        ```
        fetch_context → architect → auditor → (revise loop)
                                                    ↓
                                           youtube_enricher → personalizer → save → END
        ```

* **Frontend Updates:**
    * `apiTransformers.ts` — Already reads `youtube_url`, `title`, `duration` from backend; enricher overwrites these in-place so no transformer changes needed.
    * `CircleTimeTab.tsx` — Relabeled "Lyrics" → "Educator Script" for both greeting and goodbye songs (AI script ≠ video lyrics).

### Bug Fixes During Integration

* **Gemini output truncated at ~64K chars → JSON ValidationError:**
    * Increased `max_output_tokens` to 65,536 in both Architect and Personalizer Gemini calls.

* **Frontend crash on null plan (`Cannot read property 'daily_plans' of null`):**
    * Modified `planner.py` router to fall back to `draft_plan` when `personalized_plan` is null (e.g. auditor rejected after max iterations).
    * Modified `personalizer.py` to not set `error` when skipping due to auditor rejection — allows draft plan fallback without triggering 500.

* **`ValidationError: Invalid JSON: lone leading surrogate in hex escape`:**
    * Added `_SURROGATE_RE` regex to both `architect.py` and `personalizer.py` to sanitize Gemini's invalid Unicode surrogate escapes before Pydantic validation.

### Files Created / Modified

| File | Action |
|---|---|
| `backend/app/agents/tools.py` | Rewritten — `search_youtube_video` returns full metadata dict |
| `backend/app/agents/youtube_enricher.py` | **Created** — Dedicated LangGraph enricher node |
| `backend/app/agents/graph.py` | Modified — Wired `youtube_enricher` node into pipeline |
| `backend/app/agents/architect.py` | Modified — Removed inline YouTube enrichment, added surrogate sanitizer, increased max_output_tokens |
| `backend/app/agents/personalizer.py` | Modified — Added surrogate sanitizer, increased max_output_tokens |
| `backend/app/api/routers/planner.py` | Modified — draft_plan fallback when personalized is null |
| `backend/config.py` | Modified — Added `YOUTUBE_API_KEY` |
| `backend/requirements.txt` | Modified — Added `httpx>=0.27.0` |
| `src/app/components/tabs/CircleTimeTab.tsx` | Modified — "Lyrics" → "Educator Script" |

---

## Phase 8: YouTube Pipeline Fix + DB Upsert + Frontend Theme Fix
**Status:** Complete
**Date:** March 12, 2026

### Problem Statement

Three related issues reported after deployment:

1. **YouTube videos not embedding:** Greeting song, goodbye song, and yoga pose sections showed blank iframes with dirty titles containing hashtags (`#kidssongs`), HTML entities (`&amp;`), and Unicode junk (`≡♥`). Videos were not clickable or playable.
2. **Plans accumulating in DB:** Every plan generation INSERT'd a new row into `weekly_plans` — no upsert. 10+ duplicate rows piled up for the same user + week.
3. **Fox Forest theme always applied:** After generating new themes, the ThemeContext silently defaulted to the static Fox Forest theme instead of the user's AI-generated selection.

### Root Cause Analysis

**YouTube (Critical):** The pipeline order was `youtube_enricher → personalizer → save`. The enricher injected `youtube_url` into `draft_plan`, but the Personalizer then called Gemini with `response_schema=WeekPlanSchema` — which has **no `youtube_url` field** on `SongSchema` or `YogaPoseSchema`. Gemini's structured output silently dropped all YouTube data. The saved `personalized_plan` had empty URLs.

Additionally, `_clean_youtube_title` only split on `|`/`-`/`/` separators without stripping hashtags, HTML entities, or Unicode control characters.

Search queries were too verbose (e.g. `"good morning hello circle time song toddlers kids Starry Night Dreamers"`) — too many keywords confused YouTube's algorithm, returning irrelevant results. Only 1 result was fetched (`maxResults=1`) with no channel quality filtering.

**DB Upsert:** `save_plan_node` always called `session.add(WeeklyPlan(...))` (INSERT). The index on `(user_id, week_number)` had no unique constraint, so duplicates accumulated silently.

**Fox Forest Theme:** In `GenerateWeekModal.tsx`, `registerDynamicThemes(transformed)` and `setTheme(transformed[0].id)` ran in the same synchronous block. React hadn't flushed the `dynamicThemes` state update yet, so `findTheme(id)` read stale state → returned `undefined` → `setTheme` silently no-op'd → `currentTheme` stayed as `themeLibrary[0]` = Fox Forest.

### Fixes Applied

#### 1. Pipeline Reorder (`graph.py`)

Moved `youtube_enricher` to run **after** `personalizer`:
```
fetch_context → architect → auditor → (revise loop)
                                            ↓
                               personalizer → youtube_enricher → save → END
```
YouTube URLs are now injected into the **final** plan (after all Gemini calls), so they're never lost.

#### 2. Enricher Updated (`youtube_enricher.py`)

- Now reads `personalized_plan` first, falls back to `draft_plan`
- Returns the correct state key (`personalized_plan` or `draft_plan`)
- **Concise song queries with theme keyword:**
  - New helper `_extract_theme_keyword(theme)` pulls one concrete noun: "Busy Bees" → `bee`, "Fox Forest" → `fox`, "Bug Express" → `bug`
  - Greeting: `"good morning {keyword} song for toddlers"` (was: `"good morning hello circle time song toddlers kids {full theme name}"`)
  - Goodbye: `"goodbye {keyword} song for toddlers"`
  - De-pluralises simple cases: bees→bee, foxes→fox, butterflies→butterfly
  - Skips generic filler words (little, busy, bright, friendly, friends, etc.)

#### 3. YouTube Search Improvements (`tools.py`)

- **`_clean_youtube_title` rewritten:**
  1. HTML-unescapes (`&amp;` → `&`)
  2. Strips hashtag blocks (`#kidssongs #nurseryrhymes`)
  3. Strips Unicode box-drawing / dingbats / musical symbols (U+2300–27FF)
  4. Splits on `|`, `/`, `–`, `—`, `-` separators
  5. Returns first segment ≥ 5 chars

- **Trusted channel scoring:**
  - `maxResults` increased from 1 → 5
  - Scores each result: bonus for trusted kids channels (Super Simple Songs, The Kiboomers, Cosmic Kids Yoga, GoNoodle, Pinkfong, CoComelon, Jack Hartmann, The Singing Walrus, Bounce Patrol, Little Baby Bum, Sesame Street, Dave and Ava, Badanamu)
  - Picks highest-scored result (falls back to first result if no trusted match)

#### 4. DB Upsert Fix (`graph.py` + `models.py`)

- `save_plan_node` now queries for existing plan by `(user_id, week_number)` first:
  - If found → **UPDATE** all columns in place
  - If not → **INSERT** new row
- Added `UniqueConstraint("user_id", "week_number", name="uq_weekly_plans_user_week")` to `WeeklyPlan` model
- Generated and applied Alembic migration (`023b423663bf`)
- Cleaned up 10 duplicate rows from production DB (kept newest per user+week)

#### 5. Frontend Theme Fix (`GenerateWeekModal.tsx`)

- Replaced `setTheme(id)` (stale lookup) with `setThemeFromDetail(themeObject)` (bypasses ID lookup)
- Fixed in 3 call sites: `fetchThemes`, `handleShuffle`, `handleSelectTheme`

### Files Created / Modified

| File | Action |
|---|---|
| `backend/app/agents/graph.py` | Pipeline reorder + upsert in `save_plan_node` + `select` import |
| `backend/app/agents/youtube_enricher.py` | Read `personalized_plan` first; simplified queries; `_extract_theme_keyword` |
| `backend/app/agents/tools.py` | Rewrote `_clean_youtube_title`; trusted channel scoring; `maxResults=5`; `html` import |
| `backend/app/db/models.py` | Added `UniqueConstraint` + `UniqueConstraint` import |
| `backend/alembic/versions/023b423663bf_...py` | Migration: unique constraint on `(user_id, week_number)` |
| `src/app/components/GenerateWeekModal.tsx` | `setThemeFromDetail` replaces `setTheme` (3 call sites) |

---

## Known Bug: Database Collision — Stale Plan Loaded on Re-generation
**Status:** ✅ Resolved (Phase 8)
**Date:** March 11, 2026 (reported) → March 12, 2026 (fixed)
**Severity:** Critical

### Symptom

When a user generates multiple themes for the same week (e.g. Week 1 "Fox Forest", then Week 1 "Busy Bees"), the frontend always loads the **oldest** plan instead of the newly generated one. The top-left theme name shows an old theme even after generating a new plan.

### Root Cause

`save_plan_node` in `graph.py` always **inserted a new row** into `weekly_plans`. The DB had an index on `(user_id, week_number)` but **no unique constraint**, so multiple rows accumulated for the same user + week.

### Fix Applied

See Phase 8, section 4 above. Upsert logic + unique constraint + Alembic migration + duplicate cleanup.

---

## Phase 9: Pipeline Speed Optimization
**Status:** Complete
**Date:** March 12–13, 2026

### Problem Statement

Plan generation takes **3–4 minutes**, making users think the pipeline is stuck in an infinite loop. Root cause: the auditor almost always rejects the first 2 architect drafts (strict thresholds: `safety < 7`, `developmental_fit < 6`), forcing 3 full architect→auditor iterations before the cap kicks in. Each Gemini 2.5 Flash call takes 30–50s due to deep internal reasoning.

### Fixes Applied (Round 1 — March 12)

#### 1. Reduced Max Iterations: 3 → 2 (`graph.py`)

Changed `route_auditor` cap from `iteration_count >= 3` to `>= 2`. The architect gets one revision chance, then force-accepts. Most second-pass critiques are minor (creativity/theme) not safety.

#### 2. Loosened Auditor Thresholds + Softer Prompt (`auditor.py`)

- `safety < 7` → `safety < 5` (was overly pedantic)
- `developmental_fit < 6` → `developmental_fit < 4`
- Added prompt guidance: "If the only issues are minor (vague safety_notes, slightly generic theme connections), ACCEPT with constructive suggestions rather than rejecting."

#### 3. Safety Checklist in Architect Prompt (`architect.py`)

Added a "SAFETY CHECKLIST — verify BEFORE outputting" section to `ARCHITECT_SYSTEM_PROMPT` that mirrors the auditor's exact criteria (choking hazards, toxic materials, unsupervised water, age-capability, duration, theme connection). This "shift left" approach means the architect self-checks, reducing auditor rejections at source.

#### 4. Attempted `gemini-3-flash-preview` — Reverted

Attempted to switch all three agents to `gemini-3-flash-preview` with per-agent `thinking_level` for faster inference. However:
- The model returned **404 NOT_FOUND** on Vertex AI (`us-central1`) — not yet available for this project.
- The installed `google-genai>=1.0.0` SDK also rejects `thinking_level` as an unknown parameter on `GenerateContentConfig`.
- **Reverted all agents back to `gemini-2.5-flash`.** Can revisit when the model is GA and the SDK is updated.

### Fixes Applied (Round 2 — March 13)

#### 5. Reduced `max_output_tokens`: 65536 → 24576 (`architect.py`, `personalizer.py`)

Plans are typically 15–20K tokens. The previous 64K ceiling forced Gemini to allocate maximum generation capacity. Reducing to 24K (25% safety margin above observed output) cuts generation latency by ~20–30% per call.

#### 6. Lowered Architect Temperature: 0.9 → 0.7 (`architect.py`)

Still creative, but converges faster and produces more focused output. The detailed safety checklist already ensures quality. Reduces token waste from exploratory reasoning.

#### 7. Student Context Cache — 5-min TTL (`tools.py`)

Added in-memory TTL cache (`_student_context_cache`) around `fetch_student_context()`. Both the theme generation endpoint and the plan pipeline's `fetch_context_node` call this function — cache avoids redundant DB queries within a 5-minute window. Uses `time.monotonic()` for reliable TTL tracking.

### Expected Performance

| Metric | Before (Phase 8) | After Round 1 | After Round 2 |
|---|---|---|---|
| Typical iterations | 3 (always hit cap) | 1–2 | 1–2 |
| Gemini calls | 7 (3×arch + 3×aud + 1×pers) | 3–4 | 3–4 |
| max_output_tokens | 65536 | 65536 | 24576 |
| Architect temperature | 0.9 | 0.9 | 0.7 |
| Student context cache | none | none | 5-min TTL |
| Estimated total time | ~210s (3.5 min) | ~60–90s | ~45–50s |

### Files Modified

| File | Change |
|---|---|
| `backend/app/agents/graph.py` | `iteration_count >= 3` → `>= 2` |
| `backend/app/agents/auditor.py` | Thresholds lowered (safety<5, dev_fit<4), softer accept-with-suggestions prompt |
| `backend/app/agents/architect.py` | Safety checklist, `temperature` 0.9→0.7, `max_output_tokens` 65536→24576 |
| `backend/app/agents/personalizer.py` | `max_output_tokens` 65536→24576 |
| `backend/app/agents/tools.py` | `_student_context_cache` with 5-min TTL on `fetch_student_context()` |

---

## Phase 10: Yoga Vector DB Integration
**Status:** Complete
**Date:** March 13, 2026

### Problem Statement

Yoga poses in Circle Time were previously hardcoded or AI-generated with fictional names, benefits, and YouTube video links. There was no real yoga content library — the AI invented poses, and the frontend displayed YouTube iframes with timers. This didn't match the project's goal of using the **"Yoga for the Classroom" PDF** as the source of truth for yoga content.

### Key Accomplishments

#### 1. Database: `yoga_poses` Table (`backend/app/db/models.py`)

- Added `YogaPose` SQLAlchemy model with `name` (unique), `image_url`, `how_to` (JSONB list), `creative_cues` (JSONB list), `embedding` (Vector(768)), `created_at`.
- Generated and applied Alembic migration.

#### 2. Yoga Catalog Seeder (`backend/scripts/seed_yoga_catalog.py`)

Pipeline per PDF page:
1. Parse raw text with Gemini → `{name, how_to, creative_cues}`
2. Match image file in `data_prep/images/` by kebab-case slug
3. Upload image to GCS (`yoga/` folder) with `make_public()`
4. Generate 768-dim embedding via `text-embedding-004`
5. Upsert row into `yoga_poses` table

Prerequisite: `extract_pdf_raw.py` generates `raw_text.json` + extracted images.
Result: ~30 poses seeded with images, instructions, creative cues, and embeddings.

#### 3. Schema Update (`backend/app/agents/schemas.py`)

`YogaPoseSchema` fields changed:
- **Removed:** `benefits` (str), `duration` (int)
- **Added:** `image_url` (str, default ""), `how_to` (list[str], default []), `creative_cues` (list[str], default [])

#### 4. Architect Prompt Update (`backend/app/agents/architect.py`)

New instruction: "For yoga_poses, provide ONLY 2–3 entries with a short thematic keyword phrase in the `name` field (e.g. 'forest animals', 'tree balance'). Leave image_url, how_to, and creative_cues empty — the Enricher will fill them."

#### 5. Enricher Overhaul (`backend/app/agents/youtube_enricher.py`)

- **YouTube search for songs:** Unchanged (greeting + goodbye).
- **YouTube search for yoga:** **Removed entirely.**
- **Vector DB search for yoga:** New `_find_yoga_poses(theme, keywords, limit=3)`:
  1. Collects Architect keyword phrases from `yoga_poses[].name`
  2. Builds query: `"kids yoga poses for theme: {theme} {keywords}"`
  3. Embeds via Gemini `text-embedding-004` (768-dim)
  4. Queries `yoga_poses` table: `ORDER BY cosine_distance(embedding, query_vector) LIMIT 3`
  5. Overwrites `circle_time["yoga_poses"]` with DB results
- Song searches + yoga vector search run in parallel via `asyncio.gather()`.

#### 6. Frontend: API Transformer (`src/app/utils/apiTransformers.ts`)

- Removed `DEFAULT_YOGA_VIDEO_MAP` (dead code).
- Yoga pose mapping now uses: `image_url` → `imageUrl`, `how_to` → `howTo`, `creative_cues` → `creativeCues`.

#### 7. Frontend: YogaSection Component (`src/app/components/circle-time/YogaSection.tsx`)

Complete rewrite (360 lines → 189 lines):
- **Removed:** YouTube iframe, timer, auto/manual mode, calm mode, duration buttons, benefits display.
- **Added:** GCS pose image (`object-contain`, `max-h-[500px]`), foldable "How To" accordion (numbered steps, purple theme), foldable "Creative Cues" accordion (sparkle bullets, pink theme).
- **Kept:** Pose carousel navigation (previous/next/random).

#### 8. Frontend: Mock Data & PDF Generator

- `mockData.ts` — Updated `yogaPoses` type: `imageUrl`, `howTo`, `creativeCues`. Added `as const` to `energyLevel` literals to fix union type error.
- `pdfGenerator.ts` — Fixed 4 pre-existing type errors:
  - `week.description` → inline theme text
  - `week.developmentalDomains` → `week.objectives`
  - `activity.ageAdaptations[...]` → `activity.adaptations.map(...)`

### Bug Fixes

1. **Yoga images returning 403 Forbidden:** GCS objects were uploaded without public ACL. Added `blob.make_public()` to `seed_yoga_catalog.py`. Existing objects fixed via `gcloud storage objects update`.

2. **Yoga images cropped in UI:** `object-cover` + `maxHeight: 400px` cropped tall portrait photos to a narrow horizontal strip. Changed to `object-contain` + `max-h-[500px]`.

### Files Created / Modified

| File | Action |
|---|---|
| `backend/app/db/models.py` | Added `YogaPose` model |
| `backend/scripts/seed_yoga_catalog.py` | Created — PDF→DB yoga seeder with GCS upload + embeddings |
| `backend/app/agents/schemas.py` | Modified — `YogaPoseSchema` fields replaced |
| `backend/app/agents/architect.py` | Modified — Yoga keyword-only prompt |
| `backend/app/agents/youtube_enricher.py` | Major rewrite — Vector DB yoga search replaces YouTube |
| `src/app/utils/apiTransformers.ts` | Modified — New yoga field mapping, removed dead code |
| `src/app/components/circle-time/YogaSection.tsx` | Major rewrite — Image + accordion UI |
| `src/app/utils/mockData.ts` | Modified — New yoga type + `as const` fix |
| `src/app/utils/pdfGenerator.ts` | Modified — Fixed 4 pre-existing type errors |
| `CIRCLE_TIME_YOGA_MUSIC_MOVEMENT.md` | Updated to v2.0 |
| `YOGA_TIME_DAILY_SCHEDULE_INTEGRATION.md` | Updated to v1.1 |
| `backend/AGENTIC_PIPELINE_SYSTEM.md` | Updated enricher + schema docs |
| `backend/DATABASE_SCHEMA_SYSTEM.md` | Added `yoga_poses` table + seeder docs |

### Architecture Notes

- **Vector search replaces YouTube for yoga:** The enricher now has two distinct data sources — YouTube API for songs, PostgreSQL + pgvector for yoga poses. This ensures yoga content is always from the vetted PDF catalog.
- **Embedding strategy:** Combined `theme + architect keywords` produces a single query vector. This finds poses semantically related to the weekly theme (e.g. "ocean" → Boat Pose, Fish Pose).

---

## Phase 8: Performance Optimization — Curriculum Generation Pipeline
**Status:** Complete
**Date:** March 13, 2026

### Objective

Reduce overall curriculum generation time from ~147 seconds to under 115 seconds through infrastructure upgrades, database optimizations, and LLM prompt engineering.

### Performance Analysis (Baseline)

From production logs, the pipeline breakdown was:
- **Cold start:** 10.49s (Cloud Run instance startup)
- **Architect agent:** ~68s (Gemini generates 34,748 chars)
- **Auditor agent:** ~22s (Gemini evaluates safety)
- **Personalizer agent:** ~56s (Gemini adds child-specific details)
- **YouTube/Yoga enricher:** ~1s (already parallelized)
- **Total:** 147.284 seconds

### Key Accomplishments

#### 1. Infrastructure Upgrades (`scripts/deploy-backend.sh`)
**Expected savings: -15s**

Updated Cloud Run deployment configuration:
- **Memory:** `1Gi` → `2Gi` (more headroom for concurrent operations)
- **CPU:** `1 vCPU` → `2 vCPU` (faster JSON parsing, schema validation, DB queries)
- **Min instances:** `0` → `1` (eliminates 10s cold start penalty)
- **CPU allocation:** Added `--no-cpu-throttling` (keeps CPU active during request processing)

**Cost impact:** ~$15-20/month to keep 1 instance warm.

#### 2. Parallel Context Fetching (`backend/app/agents/graph.py`)
**Expected savings: -3s**

Refactored `fetch_context_node()` to run `fetch_student_context()` and `query_pedagogy()` concurrently:
- Added `import asyncio` to module imports
- Replaced sequential `await` calls with `asyncio.gather(student_coro, pedagogy_coro, return_exceptions=True)`
- Implemented graceful error handling for partial failures — if one fetch fails, the other still succeeds and the graph continues with a fallback value
- Both operations are read-only, making parallelization safe

#### 3. Database Optimizations
**Expected savings: -2s**

**3a. PostgreSQL Upsert (`backend/app/agents/graph.py`)**
- Replaced SELECT + conditional INSERT/UPDATE pattern in `save_plan_node()` with a single `INSERT ... ON CONFLICT DO UPDATE` statement
- Uses existing `uq_weekly_plans_user_week` constraint
- Eliminates one DB roundtrip per plan save
- Changed import from `sqlalchemy.select` to `sqlalchemy.dialects.postgresql.insert as pg_insert`

**3b. Composite Index (`backend/app/db/models.py`)**
- Added `Index("ix_students_user_active", "user_id", "is_active")` to `Student` model
- Optimizes the `fetch_student_context()` query which filters by both columns
- Created Alembic migration: `2026_03_13_f8a2b1c3d4e5_add_students_composite_index.py`

#### 4. Gemini Prompt Optimization
**Expected savings: -12s**

**4a. Architect (`backend/app/agents/architect.py`)**
- Trimmed system prompt from ~500 words to ~250 words
- Removed filler words and consolidated redundant sections
- Preserved all essential instructions, safety checklist, and structural rules

**4b. Auditor (`backend/app/agents/auditor.py`)** — **Biggest win**
- Trimmed system prompt from ~400 words to ~180 words
- **Reduced input payload:** Instead of sending the full 34KB draft plan with `indent=2`, now extracts only safety-relevant fields:
  - Included: `theme`, `circle_time`, `daily_plans[].activities[]` (filtered to `title`, `domain`, `materials`, `safety_notes`, `adaptations`, `duration`, `description`, `theme_connection`)
  - Excluded: `newsletter`, `palette`, `objectives`, `week_range`, activity IDs, reflection prompts
- **Compact JSON:** Changed from `json.dumps(plan, indent=2)` to `json.dumps(plan, separators=(',',':'))` to eliminate whitespace tokens
- **Result:** Input reduced from ~8,000 tokens to ~2,000 tokens (~75% reduction)

**4c. Personalizer (`backend/app/agents/personalizer.py`)**
- Trimmed system prompt from ~350 words to ~180 words
- Consolidated constraints and guidelines into compact bullet points
- Switched to compact JSON (`separators=(',',':')`) for plan input

### Files Modified

| File | Changes |
|---|---|
| `scripts/deploy-backend.sh` | Added `--memory 2Gi --cpu 2 --min-instances 1 --no-cpu-throttling` |
| `backend/app/agents/graph.py` | Parallel context fetching + PostgreSQL upsert |
| `backend/app/db/models.py` | Added composite index on `students(user_id, is_active)` |
| `backend/alembic/versions/2026_03_13_f8a2b1c3d4e5_add_students_composite_index.py` | New migration for composite index |
| `backend/app/agents/architect.py` | Trimmed system prompt (~50% reduction) |
| `backend/app/agents/auditor.py` | Trimmed system prompt + filtered input payload (~75% token reduction) |
| `backend/app/agents/personalizer.py` | Trimmed system prompt + compact JSON |

### Expected Results

| Phase | Time Reduction | Cumulative Total | Effort |
|-------|---------------|------------------|--------|
| Baseline | - | 147s | - |
| Phase 1 (Infrastructure) | -15s | 132s | 10 min |
| Phase 2 (Parallel Context) | -3s | 129s | 15 min |
| Phase 3 (DB Optimization) | -2s | 127s | 30 min |
| Phase 4 (Prompt Optimization) | -12s | 115s | 2 hrs |
| **Total** | **-32s** | **~115s** | **~3 hrs** |

**Overall improvement:** 22% reduction in generation time (147s → 115s)

### Deployment Steps

1. Run Alembic migration to create composite index:
   ```bash
   cd backend
   alembic upgrade head
   ```

2. Deploy to Cloud Run with new configuration:
   ```bash
   ./scripts/deploy-backend.sh
   ```

3. Monitor production logs to verify actual performance improvements

### Architecture Notes

- **Infrastructure vs Code:** Infrastructure upgrades (Phase 1) provide the largest single improvement (15s) with minimal code changes, demonstrating the value of proper Cloud Run configuration for AI workloads.
- **Auditor optimization strategy:** The Auditor doesn't need the full plan — it only evaluates safety, developmental fit, and thematic coherence. Filtering to relevant fields and using compact JSON cuts input tokens by 75% without compromising audit quality.
- **Parallelization safety:** Context fetching is safe to parallelize because both operations are read-only. The Architect → Auditor → Personalizer sequence must remain sequential due to data dependencies and safety requirements.
- **Model choice:** Gemini 2.5 Flash is already the optimal model for this use case — no further model upgrades available.
- **GCS public images:** Pose photos are served directly from `https://storage.googleapis.com/{bucket}/yoga/{slug}.png`. No CDN or signed URLs needed for public educational content.

---

## Phase 9-10-11: Calendar View System & Timeline Synchronization & PDF Generation
**Status:** Complete
**Date:** March 17, 2026

### Problem Statement

Three critical issues emerged with the calendar view and plan management system:

1. **Calendar View 500 Error:** The calendar view was completely blank, showing "No plans yet" even though plans existed in the database. Backend returned `500 Internal Server Error` on `GET /api/planner/{user_id}/plans`.
2. **Week Numbering Collision:** Multiple plans generated on the same day had identical `week_range`, `month`, and `week_of_month` values (e.g., both showing "Week 3 • 3/16-3/20"), making them indistinguishable in the UI.
3. **Curriculum vs Calendar Mismatch:** The system didn't maintain a strict timeline where Curriculum Week N always maps to the Nth chronological week from today.

### Root Cause Analysis

**500 Error (Critical):**
- `list_plans`, `reorder_plans`, and `get_plan` endpoints all referenced `p.pdf_url` in their response serialization
- The `pdf_url` column existed in the database (added via Alembic migration `c3d4e5f6a7b8`)
- However, the `WeeklyPlan` SQLAlchemy model in `models.py` was missing the `pdf_url: Mapped[str | None]` declaration
- Result: `AttributeError: 'WeeklyPlan' object has no attribute 'pdf_url'` → 500 on every plan-list request

**Stale Unique Constraint:**
- The `WeeklyPlan` model's `__table_args__` still declared `UniqueConstraint("user_id", "year", "month", "week_of_month")` from the original schema
- Migration `d4e5f6a7b8c9` had already swapped this to `UniqueConstraint("user_id", "week_number")` in the actual database
- The ORM model was out of sync with the DB schema

**Week Numbering Issues:**
- `generate_plan` used `max(week_number) + 1` to assign the next week number
- When a plan was deleted, this left gaps (e.g., weeks 1, 2, 4, 5 → next plan becomes week 6 instead of 5)
- All plans generated on the same day received identical `week_range` because `_compute_week_info()` always used `date.today()`
- The reorder endpoint accepted client-computed date fields but didn't enforce chronological consistency

### Fixes Applied

#### 1. Database Model Sync (`backend/app/db/models.py`)

**Added missing `pdf_url` column:**
```python
pdf_url: Mapped[str | None] = mapped_column(
    String(512), doc="Public GCS URL to the generated PDF for this plan."
)
```

**Fixed unique constraint to match DB:**
```python
__table_args__ = (
    UniqueConstraint("user_id", "week_number",
                     name="uq_weekly_plans_user_week_number"),
    Index("ix_weekly_plans_user_created", "user_id", "created_at"),
)
```

#### 2. Gap-Free Week Numbering (`backend/app/api/routers/planner.py`)

Changed generation logic from `max(week_number) + 1` to `count(plans) + 1`:
```python
# Before:
result = await session.execute(
    select(func.coalesce(func.max(WeeklyPlan.week_number), 0))
    .where(WeeklyPlan.user_id == user_uid)
)
global_week_number = result.scalar() + 1

# After:
result = await session.execute(
    select(func.count(WeeklyPlan.id))
    .where(WeeklyPlan.user_id == user_uid)
)
global_week_number = result.scalar() + 1
```

This ensures week numbers stay sequential (1, 2, 3...) even after deletions.

#### 3. Server-Side Timeline Enforcement (`backend/app/api/routers/planner.py`)

**Simplified `PlanPositionUpdate` schema:**
```python
# Before:
class PlanPositionUpdate(BaseModel):
    plan_id: str
    week_number: int
    week_range: str
    year: int
    month: int
    week_of_month: int

# After:
class PlanPositionUpdate(BaseModel):
    """A single plan ID in the new desired order."""
    plan_id: str
```

**Rewrote `reorder_plans` endpoint:**
- Client now sends only ordered `plan_id` list
- Server assigns sequential `week_number = 1, 2, 3...` based on position
- Server recomputes all date fields via `_compute_week_info(today + (N-1) weeks)`
- Ensures Curriculum Week N always maps to today + (N-1) calendar weeks

```python
# Phase 2: assign sequential 1-based numbers with server-computed dates
today = date.today()
for new_num, uid in enumerate(plan_uids, start=1):
    info = _compute_week_info(today=today + timedelta(weeks=new_num - 1))
    await session.execute(
        sa_update(WeeklyPlan)
        .where(WeeklyPlan.id == uid, WeeklyPlan.user_id == user_uid)
        .values(
            week_number=new_num,
            week_range=info["week_range"],
            year=info["year"],
            month=info["month"],
            week_of_month=info["week_of_month"],
        )
    )
```

**Delete endpoint already correct:**
- The `DELETE /{user_id}/plan/{plan_id}` endpoint (added in previous session) already implemented the correct renumbering + recompute logic
- No changes needed

#### 4. Frontend Simplification

**API interface (`src/app/utils/api.ts`):**
```typescript
// Simplified from 6 fields to 1
export interface PlanPositionUpdate {
  plan_id: string;
}
```

**CalendarView reorder logic (`src/app/pages/CalendarView.tsx`):**
```typescript
// Before: Client computed all date fields
const updates: PlanPositionUpdate[] = localPlans.map((plan, idx) => ({
  plan_id: plan.id,
  week_number: origSorted[idx].global_week_number,
  week_range: origSorted[idx].week_range,
  year: origSorted[idx].year,
  month: origSorted[idx].month,
  week_of_month: origSorted[idx].week_of_month,
}));

// After: Client sends only ordered IDs
const updates: PlanPositionUpdate[] = localPlans.map((plan) => ({
  plan_id: plan.id,
}));
```

#### 5. Database Wipe for Clean Testing

Truncated both tables to ensure fresh start:
```sql
DELETE FROM weekly_plans;
DELETE FROM theme_pool;
```

#### 6. PDF Generation & Storage System

**Architecture:**
- PDFs are generated on-demand via backend endpoints, not during plan generation
- Generated PDFs are uploaded to GCS bucket and cached with public URLs
- `pdf_url` column stores the GCS public URL for each plan

**Endpoints (`backend/app/api/routers/planner.py`):**

1. **`GET /{user_id}/plan/{plan_id}/pdf`** — Primary PDF download endpoint
   - Checks if cached `pdf_url` exists in database
   - If cached: Returns 302 redirect to GCS URL
   - If not cached: Generates PDF, uploads to GCS, saves URL to DB, returns PDF bytes
   - GCS path: `weekly-plans/{plan_id}.pdf`

2. **`POST /{user_id}/plan/{plan_id}/regenerate-pdf`** — Force regenerate PDF
   - Deletes old PDF from GCS (if exists)
   - Generates fresh PDF with current plan data
   - Uploads to GCS with new timestamp
   - Updates `pdf_url` in database
   - Returns new PDF bytes

3. **`GET /{user_id}/week/{week_number}/pdf`** — Legacy endpoint (by week number)
   - Fetches plan by `(user_id, week_number)`
   - Generates PDF on-the-fly (no caching)
   - Used for backward compatibility

**PDF Service (`backend/app/services/pdf_service.py`):**
- `generate_weekly_pdf(curriculum_data)` — Renders HTML template to PDF via WeasyPrint
- `upload_pdf_to_gcs(pdf_bytes, plan_id)` — Uploads to GCS, makes public, returns URL
- `save_pdf_url(plan_id, pdf_url)` — Updates `weekly_plans.pdf_url` column
- `delete_pdf_from_gcs(plan_id)` — Removes old PDF from bucket

**Frontend Integration (`src/app/components/CurriculumPDFDownload.tsx`):**
- Calls `downloadPlanPDF(week.id, week.pdfUrl)` from `api.ts`
- If `pdfUrl` exists: Direct download from cached GCS URL
- If no `pdfUrl`: Triggers generation via `/plan/{id}/pdf` endpoint
- "Regenerate PDF" button calls `/regenerate-pdf` endpoint

**Migration History:**
- `c3d4e5f6a7b8` — Added `pdf_url` column to `weekly_plans` table
- Phase 11 — Added `pdf_url` to SQLAlchemy model (fixed 500 error)

### Architecture Notes

**Timeline Invariant:**
- Curriculum Week 1 = this week (Monday–Friday)
- Curriculum Week 2 = next week
- Curriculum Week N = today + (N-1) weeks
- This mapping is **always** maintained by the server, regardless of when plans were generated or how they're reordered

**Client Responsibility:**
- Send ordered list of `plan_id` values
- Display plans in the order returned by the server
- Trust server-computed date fields

**Server Responsibility:**
- Assign sequential `week_number` (1, 2, 3...)
- Compute `week_range`, `year`, `month`, `week_of_month` based on `week_number`
- Maintain the timeline invariant on every write operation (generate, reorder, delete)

**Why Server-Side Recompute:**
- Prevents client/server date calculation drift
- Ensures all plans have consistent, chronologically ordered week ranges
- Simplifies frontend logic (no date math)
- Single source of truth for timeline mapping

### Files Modified

| File | Changes |
|---|---|
| `backend/app/db/models.py` | Added `pdf_url` mapped column; fixed unique constraint |
| `backend/app/api/routers/planner.py` | Generate uses `count()` not `max()`; reorder recomputes all dates server-side; simplified `PlanPositionUpdate` |
| `src/app/utils/api.ts` | Simplified `PlanPositionUpdate` interface |
| `src/app/pages/CalendarView.tsx` | Simplified `saveReorder` to send only ordered IDs |

### Testing Performed

1. **500 Error Fix:** `GET /api/planner/{user_id}/plans` returns `[]` (empty array) instead of 500
2. **Fresh Generation:** Generated 2 plans → Week 1 shows this week's dates, Week 2 shows next week's dates
3. **Reorder:** Swapping plans updates their `week_number` and `week_range` to maintain chronological order
4. **Delete:** Deleting Week 2 renumbers Week 3 → Week 2 with correct date recalculation

### Performance Impact

- **Reorder:** Slightly faster (no client-side date computation)
- **Generate:** Negligible change (count vs max query performance is identical)
- **List:** Fixed from 500 error to working response

---