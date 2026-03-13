# Agentic Pipeline System - Complete Documentation

## Overview

The **Agentic Pipeline** is a LangGraph-orchestrated multi-agent system that generates complete, safety-audited, personalized weekly curriculum plans for infant/toddler classrooms. Four specialized AI agents collaborate in sequence, with a conditional revision loop and a YouTube enrichment step, to produce publication-ready lesson plans.

---

## Pipeline Topology

```
START
  │
  ▼
┌─────────────────┐
│  fetch_context   │  Fetches student roster + pedagogy data from DB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   architect      │  Gemini generates 5-day WeekPlanSchema (temp 0.9)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    auditor       │  Gemini evaluates safety/dev-fit/coherence (temp 0.3)
└────────┬────────┘
         │
    route_auditor
    ┌────┴────┐
    │         │
 rejected   accepted
 (& iter<3)  (or iter≥3)
    │         │
    ▼         ▼
  architect  ┌─────────────────┐
  (retry)    │  personalizer    │  Child-specific names & strategies (temp 0.5)
             └────────┬────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ youtube_enricher  │  Real YouTube videos for songs & yoga
             └────────┬─────────┘
                      │
                      ▼
             ┌─────────────────┐
             │     save         │  Upserts plan, critique, logs to Postgres
             └────────┬────────┘
                      │
                      ▼
                     END
```

> **Note:** YouTube enrichment runs **after** personalization so that `youtube_url` fields
> (not part of `WeekPlanSchema`) survive — Gemini would otherwise drop them.

---

## Shared State (`state.py`)

All nodes read from and write to a single `PlannerState` TypedDict. Each node returns only the keys it modifies (`total=False`).

| Key | Type | Set By | Description |
|---|---|---|---|
| `user_id` | `str` | Input | Educator UUID |
| `thread_id` | `str` | Input | Unique pipeline run ID |
| `selected_theme` | `dict` | Input | ThemeSchema from theme generation |
| `week_number` | `int` | Input | Week number (e.g. 1) |
| `week_range` | `str` | Input | Date range (e.g. "3/10 - 3/14") |
| `student_context` | `str` | fetch_context | Formatted student roster |
| `pedagogy_context` | `str` | fetch_context | RAG-retrieved pedagogy advice |
| `draft_plan` | `dict\|None` | architect | WeekPlanSchema as dict |
| `audit_result` | `dict\|None` | auditor | AuditResultSchema as dict |
| `personalized_plan` | `dict\|None` | personalizer | Final personalized plan |
| `iteration_count` | `int` | architect | Incremented each pass (max 3) |
| `error` | `str\|None` | Any node | Error message on failure |

---

## Agent Nodes

### 1. Fetch Context (`graph.py → fetch_context_node`)

**Purpose:** Populate `student_context` and `pedagogy_context` before the Architect runs.

**Calls:**
- `fetch_student_context(user_id)` — Queries `students` table, returns formatted roster
- `query_pedagogy(theme_query)` — RAG search (currently mock keyword matching)

**Error handling:** Returns default "no data available" strings on failure.

---

### 2. Curriculum Architect (`architect.py`)

**Purpose:** Generate a complete 5-day weekly curriculum plan.

**Persona:** Senior Montessori / early-childhood curriculum designer with 20+ years experience.

**Gemini Config:**
- Model: `gemini-2.5-flash`
- Temperature: `0.9` (creative)
- Response schema: `WeekPlanSchema`
- Max output tokens: `65,536`

**Key behaviors:**
- First pass: Generates fresh plan from theme + student context + pedagogy
- Revision pass (iteration > 0): Injects Auditor critique into prompt with `⚠️ REVISION REQUIRED` section
- Sanitizes Gemini's Unicode surrogate escapes before Pydantic validation
- Returns `draft_plan` dict and increments `iteration_count`

**Structural rules enforced via system prompt:**
- Exactly 5 daily plans (Monday–Friday)
- 1–3 activities per day with safety_notes and age adaptations
- Circle time with greeting/goodbye songs, 2–5 yoga poses, read-aloud
- Newsletter with professional and warm versions
- Kebab-case IDs, valid hex palette codes

**Built-in safety checklist (shift-left):**
- NO items < 1.25” for children under 3, NO toxic/sharp materials, NO unsupervised water
- Every activity must have specific safety_notes and age-appropriate duration
- Every activity must meaningfully connect to the weekly theme
- Architect self-checks against these before outputting, reducing auditor rejections

---

### 3. Safety Auditor (`auditor.py`)

**Purpose:** Evaluate the draft plan for safety, developmental appropriateness, and thematic coherence.

**Persona:** Rigorous early-childhood safety compliance officer AND master Montessori educator.

**Gemini Config:**
- Model: `gemini-2.5-flash`
- Temperature: `0.3` (deterministic)
- Response schema: `AuditResultSchema`

**Evaluation criteria:**
1. **Physical Safety** — Choking hazards (<1.25"), toxic materials, sharp objects, unsupervised water, age-capability mismatches
2. **Developmental Appropriateness** — Activity complexity vs enrolled ages, grip stages, vocabulary expectations, duration limits
3. **Thematic Coherence** — All elements meaningfully connect to weekly theme

**Scoring rubric (1–10 each):**
- `safety` — 10 = zero hazards, 1 = life-threatening issues
- `developmental_fit` — 10 = perfectly calibrated, 1 = wildly inappropriate
- `creativity` — 10 = highly engaging, 1 = bland

**Decision rules:**
- `safety < 5` → **MUST reject**
- `developmental_fit < 4` → **MUST reject**
- Minor issues (vague safety_notes, slightly generic theme connections) → **ACCEPT with suggestions**
- Otherwise → accept with praise

**Does NOT modify** `iteration_count` — that's the Architect's job.

---

### 4. Personalizer (`personalizer.py`)

**Purpose:** Weave child-specific names, strategies, and developmental references into the approved plan.

**Persona:** Master Montessori guide with deep expertise in individualized learning.

**Gemini Config:**
- Model: `gemini-2.5-flash`
- Temperature: `0.5` (balanced)
- Response schema: `WeekPlanSchema`
- Max output tokens: `65,536`

**MAY change:**
- Activity `description` — mention children by name
- Activity `adaptations` — tailor to enrolled children's ages/tags
- Activity `reflection_prompts` — ask about specific children
- Activity `theme_connection` — connect to children's interests
- Newsletter warm version — educator style references

**MUST NOT change:**
- Core activities, titles, domains, IDs
- Materials lists
- Safety notes (audit-approved)
- Circle time songs, yoga poses
- Activity count

**Guards:**
- Skips if no `draft_plan` available
- Skips if `audit_result.accepted` is False (draft plan used as fallback)

---

### 5. YouTube Enricher (`youtube_enricher.py`)

**Purpose:** Replace AI-generated fictional song/pose titles with real YouTube video metadata.

**Runs:** Once, **after personalization** (not before). This is critical because `SongSchema` and `YogaPoseSchema` have no `youtube_url` field — if the enricher ran before the Personalizer, Gemini's structured output would drop all YouTube data.

**Reads:** `personalized_plan` first, falls back to `draft_plan`.

**Query construction:**
- `_extract_theme_keyword(theme)` — pulls one concrete noun from the theme name ("Busy Bees" → `bee`, "Fox Forest" → `fox`, "Bug Express" → `bug`). Skips filler words, de-pluralises.
- **Greeting songs:** `"good morning {keyword} song for toddlers"`
- **Goodbye songs:** `"goodbye {keyword} song for toddlers"`
- **Yoga poses:** Maps AI creative names → standard poses via `_YOGA_POSE_MAP` (e.g. "seed" → "seed to tree"), then `"{standard_pose} yoga for kids toddlers"`

**Yoga Pose Map (14 entries):**
| AI Keyword | Standard Search Term |
|---|---|
| tree | tree pose |
| cat / cow | cat cow pose |
| butterfly | butterfly pose |
| cobra | cobra pose |
| downward / dog | downward dog |
| child | child's pose |
| mountain | mountain pose |
| warrior | warrior pose |
| star | star pose |
| flower | flower pose |
| frog | frog pose |
| seed / sprout | seed to tree |

**Metadata overwrite:**
- Songs: overwrites `title`, `duration`, injects `youtube_url`
- Yoga: overwrites `name`, `duration` (uses `duration_seconds`), injects `youtube_url`

**Concurrency:** All searches fire in parallel via `asyncio.gather()`.

---

### 6. Save Plan (`graph.py → save_plan_node`)

**Purpose:** Persist the final plan, critique history, and reasoning log to PostgreSQL.

**Writes to 3 tables:**
1. `weekly_plans` — **Upserts** final plan (prefers `personalized_plan`, falls back to `draft_plan`). Queries by `(user_id, week_number)` — if exists, updates all columns in place; otherwise inserts new row. Flattens `daily_plans[].activities[]` → single activities list.
2. `critique_history` — Auditor scores, critique, accepted flag
3. `agent_reasoning_logs` — Pipeline completion summary

**Constraint:** `UniqueConstraint("user_id", "week_number")` enforces one plan per user per week at the DB level.

---

### 7. Route Auditor (`graph.py → route_auditor`)

**Purpose:** Conditional edge that decides whether to revise or proceed.

**Returns:**
- `"personalize"` → routes to personalizer if accepted, iteration cap (≥2) reached, or error present
- `"revise"` → if rejected and iterations remain

---

## Temperature Strategy

| Agent | Model | Temperature | Rationale |
|---|---|---|---|
| Architect | `gemini-2.5-flash` | 0.9 | Creative generation, self-checks safety via built-in checklist |
| Auditor | `gemini-2.5-flash` | 0.3 | Deterministic pass/fail eval with relaxed thresholds |
| Personalizer | `gemini-2.5-flash` | 0.5 | Balanced — creative for child references, stable structure |

---

## Structured Output

All three Gemini-calling agents use `response_schema` with Pydantic models. This guarantees valid JSON output matching the frontend TypeScript interfaces — zero free-text parsing.

**Important constraint:** Gemini's `response_schema` rejects deeply nested schemas with too many constraint states (`ge`, `le`, `min_length`, `Literal`). The `WeekPlanSchema` (4-level nesting) has all numeric bounds and array constraints removed. Expected values are in `Field(description=...)` instead.

---

## Error Resilience

- **Iteration cap:** Max 2 Architect passes before force-accepting
- **Error routing:** `route_auditor` checks for errors and routes forward to avoid infinite loops
- **Fallback chain:** `personalized_plan` → `draft_plan` → error
- **Surrogate sanitizer:** Regex strips Gemini's invalid Unicode surrogate escapes before Pydantic validation
- **Guard clauses:** Every node handles missing/null inputs gracefully

---

## Schemas (`schemas.py`)

### Theme Generation
- `ThemePalette` — 4 hex colors (primary, secondary, accent, background)
- `ThemeCircleTime` — Greeting style, counting context, letter examples, movement prompt, color
- `ThemeActivityExample` — Title, description, materials list
- `ThemeEnvironment` — Description, visual elements, ambiance
- `ThemeSchema` — Top-level theme with id, name, emoji, letter, shape, mood + all nested models

### Curriculum Plan
- `ObjectiveSchema` — Domain + goal pair
- `AgeAdaptationSchema` — Age group, description, modifications list
- `ActivitySchema` — Full activity: id, day, title, domain, duration, description, theme_connection, materials, safety_notes, adaptations, reflection_prompts
- `SongSchema` — Title, script (educator lyrics), duration
- `YogaPoseSchema` — Name, benefits, hold duration
- `CircleTimeSchema` — Letter, color, shape, counting_to, songs, yoga, read-aloud, discussion
- `DailyPlanSchema` — Day, focus domain, 1–4 activities
- `NewsletterSchema` — Welcome message, learning goals, home connection, professional + warm versions
- `WeekPlanSchema` — Master model: id, week_number, week_range, theme, palette, domains, objectives, circle_time, 5 daily_plans, newsletter

### Audit
- `AuditScores` — safety, developmental_fit, creativity (1–10)
- `AuditResultSchema` — accepted, critique, safety_concerns, scores

---

## Agent Tools (`tools.py`)

| Function | Purpose |
|---|---|
| `fetch_student_context(user_id)` | Query enrolled students, return LLM-formatted roster |
| `generate_theme_options(context, count)` | Call Gemini to generate ThemeSchema list |
| `query_pedagogy(query_text)` | RAG search (currently mock keyword matching) |
| `search_youtube_video(query, video_category_id?)` | Search YouTube API (5 results), prefer trusted channels, return metadata dict |
| `_parse_iso8601_duration(iso)` | Convert `PT3M8S` → `("3:08", 188)` |
| `_clean_youtube_title(raw)` | Strip hashtags, HTML entities, Unicode junk, channel suffixes |
