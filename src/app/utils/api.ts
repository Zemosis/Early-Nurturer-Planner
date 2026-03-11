/**
 * API client for the Early Nurturer Planner backend.
 *
 * All requests go through the Vite dev proxy (/api → localhost:8000).
 */

const DEFAULT_USER_ID = "83b58b5f-698b-4ae1-9529-f83d97641f01";

// ── Themes ───────────────────────────────────────────────────

export interface GenerateThemesParams {
  userId?: string;
  childAges?: string[];
  themeCount?: number;
}

export async function generateThemes(
  params: GenerateThemesParams = {}
): Promise<{ themes: Record<string, unknown>[] }> {
  const body = {
    user_id: params.userId ?? DEFAULT_USER_ID,
    child_ages: params.childAges ?? ["12-24m", "24-36m"],
    theme_count: params.themeCount ?? 5,
  };

  const res = await fetch("/api/themes/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Theme generation failed");
  }

  return res.json();
}

// ── Planner ──────────────────────────────────────────────────

export interface GeneratePlanParams {
  userId?: string;
  selectedTheme: Record<string, unknown>;
  weekNumber?: number;
  weekRange?: string;
}

export async function generatePlan(
  params: GeneratePlanParams
): Promise<{ status: string; plan: Record<string, unknown> }> {
  const body = {
    user_id: params.userId ?? DEFAULT_USER_ID,
    selected_theme: params.selectedTheme,
    week_number: params.weekNumber ?? 1,
    week_range: params.weekRange ?? "",
  };

  const res = await fetch("/api/planner/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Plan generation failed");
  }

  return res.json();
}
