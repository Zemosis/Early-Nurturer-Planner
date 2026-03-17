/**
 * API client for the Early Nurturer Planner backend.
 *
 * In development: requests go through Vite dev proxy (/api → localhost:8000).
 * In production:  VITE_API_BASE_URL points to the Cloud Run service.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
export const DEFAULT_USER_ID = "83b58b5f-698b-4ae1-9529-f83d97641f01";

// ── Theme Pool ──────────────────────────────────────────────

export interface ThemePoolItem {
  id: string;
  theme_data: Record<string, unknown>;
}

export async function fetchThemePool(
  userId: string = DEFAULT_USER_ID
): Promise<ThemePoolItem[]> {
  const res = await fetch(`${API_BASE}/api/theme-pool/${userId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch theme pool");
  }
  return res.json();
}

export async function refreshThemePool(
  keepIds: string[],
  userId: string = DEFAULT_USER_ID
): Promise<ThemePoolItem[]> {
  const res = await fetch(`${API_BASE}/api/theme-pool/${userId}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keep_ids: keepIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to refresh theme pool");
  }
  return res.json();
}

// ── Legacy Themes (kept for backward compat) ────────────────

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

  const res = await fetch(`${API_BASE}/api/themes/generate`, {
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
  themePoolId?: string;
}

export async function generatePlan(
  params: GeneratePlanParams
): Promise<{ status: string; plan: Record<string, unknown>; plan_id: string | null }> {
  const body = {
    user_id: params.userId ?? DEFAULT_USER_ID,
    selected_theme: params.selectedTheme,
    theme_pool_id: params.themePoolId ?? null,
  };

  const res = await fetch(`${API_BASE}/api/planner/generate`, {
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

// ── Plan History ────────────────────────────────────────────

export interface WeekPlanSummary {
  id: string;
  global_week_number: number;
  week_of_month: number;
  month: number;
  year: number;
  theme: string;
  theme_emoji: string;
  week_range: string;
  palette: Record<string, string> | null;
  domains: string[] | null;
  created_at: string | null;
}

export interface PlanPositionUpdate {
  plan_id: string;
  week_number: number;
  week_range: string;
  year: number;
  month: number;
  week_of_month: number;
}

export async function reorderPlans(
  updates: PlanPositionUpdate[],
  userId: string = DEFAULT_USER_ID
): Promise<WeekPlanSummary[]> {
  const res = await fetch(`${API_BASE}/api/planner/${userId}/plans/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Reorder failed");
  }
  return res.json();
}

export async function fetchAllPlans(
  userId: string = DEFAULT_USER_ID
): Promise<WeekPlanSummary[]> {
  const res = await fetch(`${API_BASE}/api/planner/${userId}/plans`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch plans");
  }
  return res.json();
}

export async function fetchPlanById(
  planId: string,
  userId: string = DEFAULT_USER_ID
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/planner/${userId}/plan/${planId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch plan");
  }
  return res.json();
}

// ── PDF Download ────────────────────────────────────────────

export interface DownloadPDFParams {
  userId?: string;
  planId: string;
  cachedPdfUrl?: string | null;
}

export async function downloadPlanPDF(
  params: DownloadPDFParams
): Promise<Blob> {
  const userId = params.userId ?? DEFAULT_USER_ID;
  const res = await fetch(
    `${API_BASE}/api/planner/${userId}/plan/${params.planId}/pdf`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "PDF download failed");
  }

  return res.blob();
}

export async function regeneratePlanPDF(
  planId: string,
  userId?: string
): Promise<Blob> {
  const uid = userId ?? DEFAULT_USER_ID;
  const res = await fetch(
    `${API_BASE}/api/planner/${uid}/plan/${planId}/pdf/regenerate`,
    { method: "POST" }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "PDF regeneration failed");
  }

  return res.blob();
}
