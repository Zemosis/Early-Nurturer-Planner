/**
 * API client for the Early Nurturer Planner backend.
 *
 * Call configureApi(baseURL) before using any API functions.
 * Web: pass import.meta.env.VITE_API_BASE_URL
 * Mobile: pass the Cloud Run URL from app config
 */

let apiBase = "";

export function configureApi(baseURL: string) {
  apiBase = baseURL;
}

export function getApiBase(): string {
  return apiBase;
}
export const DEFAULT_USER_ID = "83b58b5f-698b-4ae1-9529-f83d97641f01";

// ── Theme Pool ──────────────────────────────────────────────

export interface ThemePoolItem {
  id: string;
  theme_data: Record<string, unknown>;
  plan_id?: string | null;
}

export interface ThemePoolResponse {
  themes: ThemePoolItem[];
  generating: boolean;
  pool_size: number;
}

export async function fetchThemePool(
  userId: string = DEFAULT_USER_ID
): Promise<ThemePoolResponse> {
  const res = await fetch(`${apiBase}/api/theme-pool/${userId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch theme pool");
  }
  return res.json();
}

export async function refreshThemePool(
  keepIds: string[],
  userId: string = DEFAULT_USER_ID
): Promise<ThemePoolResponse> {
  const res = await fetch(`${apiBase}/api/theme-pool/${userId}/refresh`, {
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

  const res = await fetch(`${apiBase}/api/themes/generate`, {
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

  const res = await fetch(`${apiBase}/api/planner/generate`, {
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
}

export async function deletePlan(
  planId: string,
  userId: string = DEFAULT_USER_ID
): Promise<void> {
  const res = await fetch(`${apiBase}/api/planner/${userId}/plan/${planId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Delete failed");
  }
}

export async function reorderPlans(
  updates: PlanPositionUpdate[],
  userId: string = DEFAULT_USER_ID
): Promise<WeekPlanSummary[]> {
  const res = await fetch(`${apiBase}/api/planner/${userId}/plans/reorder`, {
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
  const res = await fetch(`${apiBase}/api/planner/${userId}/plans`);
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
  const res = await fetch(`${apiBase}/api/planner/${userId}/plan/${planId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch plan");
  }
  return res.json();
}

// ── Theme Swap ──────────────────────────────────────────────

export interface SwapThemeResult {
  status: 'existing' | 'generated';
  plan_id: string | null;
}

export async function swapTheme(
  currentPlanId: string,
  poolThemeId: string,
  userId: string = DEFAULT_USER_ID
): Promise<SwapThemeResult> {
  const res = await fetch(
    `${apiBase}/api/planner/${userId}/plan/${currentPlanId}/swap/${poolThemeId}`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Theme swap failed");
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
    `${apiBase}/api/planner/${userId}/plan/${params.planId}/pdf`
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
    `${apiBase}/api/planner/${uid}/plan/${planId}/pdf/regenerate`,
    { method: "POST" }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "PDF regeneration failed");
  }

  return res.blob();
}

// ── Material Poster Download ─────────────────────────────────

export type MaterialType = 'alphabet' | 'number' | 'shape' | 'color';
export type BulkMaterialType = MaterialType | 'days_of_the_week' | 'months_of_the_year' | 'weather';

export async function downloadMaterial(
  planId: string,
  materialType: MaterialType,
  userId: string = DEFAULT_USER_ID
): Promise<string> {
  const res = await fetch(
    `${apiBase}/api/planner/${userId}/plan/${planId}/material/${materialType}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Material download failed");
  }

  const data = await res.json();
  return data.url;
}

// ── YouTube Search ──────────────────────────────────────────

export interface YouTubeSearchResult {
  embed_url: string;
  title: string;
  duration: string;
  duration_seconds: number;
  thumbnail: string;
}

export async function searchYouTube(
  query: string,
  excludeId?: string
): Promise<YouTubeSearchResult> {
  const params = new URLSearchParams({ q: query });
  if (excludeId) params.set("exclude_id", excludeId);

  const res = await fetch(`${apiBase}/api/planner/youtube/search?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    console.error("YouTube search failed:", res.status, err);
    throw new Error(err.detail ?? "YouTube search failed");
  }
  return res.json();
}

// ── Circle Time Song Update ─────────────────────────────────

export interface SongUpdate {
  title: string;
  youtube_url: string;
  duration: string;
}

export interface CircleTimeUpdatePayload {
  greeting_song?: SongUpdate;
  goodbye_song?: SongUpdate;
}

export async function updateCircleTimeSongs(
  planId: string,
  payload: CircleTimeUpdatePayload,
  userId: string = DEFAULT_USER_ID
): Promise<{ status: string; circle_time: Record<string, unknown> }> {
  const res = await fetch(
    `${apiBase}/api/planner/${userId}/plan/${planId}/circle-time`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Circle time update failed");
  }
  return res.json();
}

// ── Schedule Sync ──────────────────────────────────────────

import type { ScheduleBlock } from '../contexts/ScheduleContext';

export async function updatePlanSchedule(
  planId: string,
  schedule: Record<string, ScheduleBlock[]>,
  userId: string = DEFAULT_USER_ID
): Promise<{ status: string; schedule: Record<string, ScheduleBlock[]> }> {
  const res = await fetch(
    `${apiBase}/api/planner/${userId}/plan/${planId}/schedule`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Schedule update failed");
  }
  return res.json();
}

// ── Bulk Material Export ────────────────────────────────────

export async function bulkExportMaterials(
  planId: string,
  materialTypes: BulkMaterialType[],
  userId: string = DEFAULT_USER_ID
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(
    `${apiBase}/api/planner/${userId}/plan/${planId}/materials/bulk-export`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material_types: materialTypes }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Bulk export failed");
  }

  // Extract filename from Content-Disposition header
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? "Materials_Bundle.pdf";

  const blob = await res.blob();
  return { blob, filename };
}

// ── Chat Assistant ─────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
}

export interface ChatThread {
  thread_id: string;
  created_at: string | null;
  preview: string;
  message_count: number;
}

export interface ChatActivityEdit {
  activity_id: string;
  title?: string;
  domain?: string;
  duration?: number;
  description?: string;
  theme_connection?: string;
  materials?: string[];
  safety_notes?: string;
  adaptations?: { age_group: string; description: string; modifications: string[] }[];
  reflection_prompts?: string[];
}

export interface ChatResponse {
  thread_id: string;
  message: ChatMessage;
  activity_edit?: ChatActivityEdit | null;
  thread_rotated: boolean;
  error?: { code: string; retryable: boolean } | null;
}

export interface ChatPlanContext {
  plan_id: string;
  week_number: number;
  theme: string;
  objectives: { domain: string; goal: string }[];
  activity_index: {
    id: string;
    day: string;
    title: string;
    domain: string;
    duration: number;
  }[];
}

export async function sendChatMessage(
  userId: string,
  body: { threadId?: string; message: string; planContext?: ChatPlanContext },
): Promise<ChatResponse> {
  const res = await fetch(`${apiBase}/api/chat/${userId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      thread_id: body.threadId ?? null,
      message: body.message,
      plan_context: body.planContext ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Chat message failed");
  }
  return res.json();
}

export async function fetchChatThreads(
  userId: string = DEFAULT_USER_ID
): Promise<ChatThread[]> {
  const res = await fetch(`${apiBase}/api/chat/${userId}/threads`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch threads");
  }
  return res.json();
}

export async function fetchChatThread(
  userId: string,
  threadId: string,
  cursor?: string,
): Promise<{ messages: ChatMessage[]; next_cursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(
    `${apiBase}/api/chat/${userId}/thread/${threadId}?${params}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch thread");
  }
  return res.json();
}

export async function startNewChatThread(
  userId: string = DEFAULT_USER_ID,
  planContext?: ChatPlanContext,
): Promise<{ thread_id: string }> {
  const res = await fetch(`${apiBase}/api/chat/${userId}/thread/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_context: planContext ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to create thread");
  }
  return res.json();
}

export async function applyActivityEdit(
  userId: string,
  planId: string,
  activityId: string,
  activityData: ChatActivityEdit,
): Promise<{ status: string; activity: Record<string, unknown> }> {
  const res = await fetch(
    `${apiBase}/api/planner/${userId}/plan/${planId}/activity/${activityId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activityData),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to apply activity edit");
  }
  return res.json();
}
