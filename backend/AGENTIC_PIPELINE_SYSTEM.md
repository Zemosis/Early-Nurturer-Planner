# Agentic Pipeline System

## Overview

The **Agentic Pipeline** is a LangGraph-orchestrated system that generates complete, personalized weekly curriculum plans for infant/toddler classrooms. A two-stage Map-Reduce architecture splits generation into a Master Architect (theme skeleton) and a Day Architect (5 daily plans with personalization), running the Day Architect concurrently with a YouTube/yoga enricher for fast generation.

---

## Pipeline Topology

```
START
  |
  v
fetch_context          Fetches student roster + pedagogy data (concurrent)
  |
  v
master_architect       Gemini generates theme skeleton (everything except daily_plans)
  |
  v
parallel_generate      asyncio.gather:
  |--- generate_days          5 daily plans with personalization baked in
  |--- enrich_circle_time     YouTube songs + DB yoga poses (vector search)
  |
  v
assemble_plan          Merges skeleton + days + enrichment into WeekPlanSchema
  |
  v
save                   Upserts to weekly_plans, logs reasoning to Postgres
  |
  v
END
```

All edges are linear (no conditional routing). Errors propagate through the state and are checked at each node.

---

## Shared State (`state.py`)

All nodes read from and write to a single `PlannerState` TypedDict (`total=False`).

| Key | Type | Set By | Description |
|---|---|---|---|
| `user_id` | `str` | Input | Educator UUID |
| `thread_id` | `str` | Input | Unique pipeline run ID |
| `selected_theme` | `dict` | Input | ThemeSchema from theme pool |
| `week_number` | `int` | Input | Curriculum week number |
| `week_range` | `str` | Input | Date range (e.g. "3/10 - 3/14") |
| `year` | `int` | Input | Calendar year |
| `month` | `int` | Input | Calendar month (1-12) |
| `week_of_month` | `int` | Input | Week within month (1-5) |
| `student_context` | `str` | fetch_context | Formatted student roster |
| `pedagogy_context` | `str` | fetch_context | RAG-retrieved pedagogy advice |
| `master_skeleton` | `dict\|None` | master_architect | MasterSkeletonSchema as dict |
| `daily_plans_raw` | `list[dict]\|None` | parallel_generate | 5 DailyPlanSchema dicts |
| `enriched_circle_time` | `dict\|None` | parallel_generate | Circle time after YouTube/yoga enrichment |
| `draft_plan` | `dict\|None` | assemble_plan | Final WeekPlanSchema as dict |
| `iteration_count` | `int` | master_architect | Set to 1 |
| `error` | `str\|None` | Any node | Error message on failure |
| `saved_plan_id` | `str\|None` | save | UUID of the saved WeeklyPlan row |

---

## Node Details

### 1. Fetch Context (`graph.py -> fetch_context_node`)

Populates `student_context` and `pedagogy_context` before the Architect runs.

**Runs concurrently via `asyncio.gather`:**
- `fetch_student_context(user_id)` -- queries `students` table, returns formatted roster
- `query_pedagogy(theme_query)` -- RAG search (currently keyword matching)

Returns default "no data available" strings on partial failure.

---

### 2. Master Architect (`architect.py -> master_architect`)

Generates the weekly theme skeleton: theme metadata, palette, domains, objectives, circle_time structure, and newsletter. Does NOT generate daily_plans.

**Gemini Config:**
- Model: `gemini-2.5-flash`
- Temperature: `0.7`
- Response MIME: `application/json`
- Max output tokens: `8,192`
- Thinking budget: `5,000`

**Output:** `MasterSkeletonSchema` validated through Pydantic, stored as `master_skeleton` in state.

**System prompt enforces:**
- Thematically cohesive skeleton (palette, letter, shape, songs all connect to theme)
- Random variation of letter/color/shape (avoids obvious picks like "G" for Garden)
- Greeting/goodbye songs as structured JSON objects with title, script, and duration
- 2-3 yoga pose keyword entries (enricher fills details from DB)
- Newsletter with professional and warm versions

---

### 3. Parallel Generate (`graph.py -> parallel_generate_node`)

Runs two coroutines concurrently via `asyncio.gather(return_exceptions=True)`:

#### 3a. Day Architect (`architect.py -> generate_days`)

Generates all 5 daily plans (Monday-Friday) with personalization baked in.

**Gemini Config:**
- Model: `gemini-2.5-flash`
- Temperature: `0.7`
- Max output tokens: `16,384`
- Thinking budget: `8,000`
- Retries: up to 3 attempts (tenacity exponential backoff)

**Output:** `DailyPlansOutputSchema` -- list of 5 `DailyPlanSchema` dicts.

**Personalization (built into system prompt):**
- Mentions children by name in activity descriptions
- Tailors adaptations to actual enrolled children per age band
- References specific children's goals and tags in reflection prompts
- Links theme connections to children's interests from bios
- Weaves targeted strategies for children with special tags (e.g. `speech_delay`)

**Safety (built into system prompt):**
- No items < 1.25" for under-3s, no toxic/sharp materials
- No unsupervised water play, no beyond-capability activities
- Duration: infants 5-10 min, toddlers 15-30 min
- Self-checks before outputting

#### 3b. Enrich Circle Time (`youtube_enricher.py -> enrich_circle_time`)

Enriches the skeleton's circle_time with real YouTube songs and DB-backed yoga poses.

**Songs (YouTube Data API):**
- Extracts a theme keyword via `_extract_theme_keyword()` (e.g. "Busy Bees" -> "bee")
- Searches: `"good morning {keyword} song for toddlers"` and `"goodbye {keyword} song for toddlers"`
- Overwrites greeting_song and goodbye_song with real title, duration, and `youtube_url`

**Yoga Poses (pgvector cosine similarity):**
- Collects keyword phrases from skeleton's `yoga_poses[].name`
- Builds query: `"kids yoga poses for theme: {theme} {keywords}"`
- Embeds via Gemini `text-embedding-004` (768-dim)
- Queries `yoga_poses` table: `ORDER BY cosine_distance(embedding, query_vector) LIMIT 3`
- Overwrites `yoga_poses` with DB results: `{name, image_url, how_to, creative_cues}`

Songs + yoga fire concurrently within this function via `asyncio.gather()`.

**Error handling:** Day generation failure is fatal. Enrichment failure is gracefully degraded (plan proceeds without enrichment).

---

### 4. Assemble Plan (`graph.py -> assemble_plan_node`)

Merges the three pieces into a complete plan:
1. Spreads `master_skeleton` into a plan dict
2. Adds `daily_plans` from the Day Architect
3. Overlays `enriched_circle_time` if enrichment succeeded

Validates through `WeekPlanSchema` via Pydantic. Falls back to unvalidated dict if validation fails. Writes result to `draft_plan`.

---

### 5. Save Plan (`graph.py -> save_plan_node`)

Persists the assembled plan to PostgreSQL:
1. **Upserts** `draft_plan` to `weekly_plans` table (conflict on `(user_id, week_number)`)
2. Flattens `daily_plans[].activities[]` into a single activities list for the DB column
3. Logs pipeline completion to `agent_reasoning_logs` table
4. Returns `saved_plan_id`

---

## Schemas (`schemas.py`)

### Theme Generation
- `ThemePalette` -- 4 hex colors (primary, secondary, accent, background)
- `ThemeCircleTime` -- Greeting style, counting context, letter examples, movement prompt
- `ThemeActivityExample` -- Title, description, materials list
- `ThemeEnvironment` -- Description, visual elements, ambiance
- `ThemeSchema` -- Top-level: id, name, emoji, letter, shape, mood, palette, activities, environment

### Curriculum Plan
- `ObjectiveSchema` -- Domain + goal pair
- `AgeAdaptationSchema` -- Age group, description, modifications list
- `ActivitySchema` -- Full activity with id, day, title, domain, duration, description, theme_connection, materials, safety_notes, adaptations, reflection_prompts
- `SongSchema` -- Title, script (lyrics), duration
- `YogaPoseSchema` -- Name, image_url (GCS), how_to (steps), creative_cues
- `CircleTimeSchema` -- Letter, color, shape, counting, songs, yoga, read-aloud, discussion
- `DailyPlanSchema` -- Day, focus domain, activities
- `NewsletterSchema` -- Welcome, learning goals, home connection, professional + warm versions
- `WeekPlanSchema` -- Master output: id, week_number, week_range, theme, palette, domains, objectives, circle_time, 5 daily_plans, newsletter

### Map-Reduce Intermediates
- `MasterSkeletonSchema` -- Everything in WeekPlanSchema except daily_plans
- `DailyPlansOutputSchema` -- Wrapper with `daily_plans: list[DailyPlanSchema]`

---

## Agent Tools (`tools.py`)

| Function | Purpose |
|---|---|
| `fetch_student_context(user_id)` | Query enrolled students, return LLM-formatted roster (cached 5 min) |
| `generate_theme_options(context, count)` | Call Gemini to generate ThemeSchema list |
| `query_pedagogy(query_text)` | RAG search (currently keyword matching) |
| `search_youtube_video(query)` | Search YouTube API (5 results), prefer trusted channels, return metadata |

---

## Theme Pool System

The theme pool is a persistent, lazy-refilled cache of 5 AI-generated themes per user. It decouples theme generation from plan generation.

```
User opens GenerateWeekModal
  |
  v
GET /api/theme-pool/{user_id}
  |
  v
Count active (is_used=False) themes
missing = 5 - count
if missing > 0: generate + insert
  |
  v
Return up to 5 themes
  |
  v
User selects theme -> POST /api/planner/generate
  { selected_theme: {...}, theme_pool_id: "uuid" }
  |
  v
Planner marks pool row is_used=True
(pool drops to 4; next GET auto-refills)
```

**Refresh:** `POST /api/theme-pool/{user_id}/refresh` with `keep_ids` array discards all non-kept themes and generates replacements.

**Background:** When `CLOUD_RUN_URL` is set, refill is enqueued via Google Cloud Tasks to `POST /internal/worker/generate-themes`. When empty (local dev), refill runs in-process via `asyncio.create_task`.

---

## Surrogate Pair Handling (`architect.py`)

Gemini sometimes returns emoji characters as JSON surrogate pairs (e.g. `\uD83D\uDC20` for a fish emoji). The `_sanitize_and_extract_json()` function:
1. Converts valid surrogate pairs to real Unicode characters
2. Strips remaining lone surrogates that would break JSON parsers
3. Extracts JSON from optional markdown code fences

---

## PDF Generation & Caching (`app/services/pdf_service.py`)

PDFs are generated on-demand (not during plan creation) and cached in GCS.

```
User clicks Download PDF
  |
  v
GET /api/planner/{user_id}/plan/{plan_id}/pdf
  |
  v
pdf_url cached? -> YES: proxy GCS bytes through backend (avoids CORS)
                -> NO:  generate cover image -> render PDF via WeasyPrint
                        -> upload to GCS -> save pdf_url to DB -> stream bytes
```

### Service Functions

| Function | Description |
|---|---|
| `generate_weekly_pdf(data)` | Jinja2 HTML template -> PDF via WeasyPrint |
| `upload_pdf_to_gcs(bytes, plan_id, theme)` | Upload to `weekly-plans/{plan_id}.pdf` |
| `save_pdf_url(plan_id, url)` | Update `weekly_plans.pdf_url` column |
| `delete_pdf_from_gcs(url)` | Delete GCS blob (used during regeneration) |

### Cover Images (`app/services/image_service.py`)

- `get_or_generate_cover_image(plan_row)` -- called before every PDF render
- Generates via Vertex AI Imagen if not already cached
- Uploaded to GCS, URL saved to `weekly_plans.cover_image_url`

---

## Error Resilience

- **Parallel failures:** `asyncio.gather(return_exceptions=True)` in `parallel_generate` -- day generation failure is fatal, enrichment failure degrades gracefully
- **Retry:** Day Architect retries up to 3 times with exponential backoff (tenacity)
- **Surrogate sanitizer:** Converts Gemini's surrogate pair escapes to real Unicode before Pydantic validation
- **Validation fallback:** `assemble_plan_node` falls back to raw dict if Pydantic validation fails
- **Guard clauses:** Every node handles missing/null inputs gracefully
