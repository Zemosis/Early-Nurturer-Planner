import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Loader2, GripVertical, LayoutList, Check, X, MessageCircle, Trash2 } from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ChatAssistant } from "../components/ChatAssistant";
import { usePlanner, fetchAllPlans, reorderPlans, deletePlan, WeekPlanSummary, PlanPositionUpdate } from 'shared';

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DRAG_TYPE = "week-plan-card";

// ── Draggable week card ──────────────────────────────────────

interface WeekCardProps {
  plan: WeekPlanSummary;
  index: number;
  displayIndex: number;
  rearrangeMode: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDelete: (plan: WeekPlanSummary) => void;
}

function WeekCard({ plan, index, displayIndex, rearrangeMode, onMove, onDelete }: WeekCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const primaryColor = plan.palette?.primary || "#387F39";
  const secondaryColor = plan.palette?.secondary || "#8B6F47";

  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: { index },
    canDrag: rearrangeMode,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DRAG_TYPE,
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        onMove(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));

  const handleClick = () => {
    if (!rearrangeMode) navigate(`/week/${plan.id}`);
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={`bg-white rounded-2xl shadow-sm border-2 p-5 transition-all
        ${rearrangeMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:shadow-md"}
        ${isDragging ? "opacity-40 scale-95" : "opacity-100"}
        ${isOver && rearrangeMode ? "ring-2 ring-primary ring-offset-2 scale-[1.01]" : ""}
      `}
      style={{ borderTopColor: primaryColor, borderTopWidth: "3px", borderColor: "transparent", borderTopStyle: "solid" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {rearrangeMode && (
            <div ref={drag as unknown as React.RefObject<HTMLDivElement>} className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted/50 rounded">
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <span className="text-3xl">{plan.theme_emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
              <h3 className="font-medium text-foreground">{plan.theme}</h3>
              <CheckCircle2 className="w-4 h-4" style={{ color: primaryColor }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Week {displayIndex} • {plan.week_range}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!rearrangeMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(plan); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              title="Delete plan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg">
            #{displayIndex}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(plan.domains || []).map((domain) => (
          <span
            key={domain}
            className="px-3 py-1 rounded-full text-sm border"
            style={{
              backgroundColor: secondaryColor + "20",
              color: secondaryColor,
              borderColor: secondaryColor + "40",
            }}
          >
            {domain}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function CalendarView() {
  const { allPlans, setAllPlans } = usePlanner();
  const [loading, setLoading] = useState(allPlans.length === 0);
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Local ordered copy used while rearranging (flat, sorted by week_number)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [localPlans, setLocalPlans] = useState<WeekPlanSummary[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<WeekPlanSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Snapshot before rearranging — used to revert on cancel/error
  const originalRef = useRef<WeekPlanSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const plans = await fetchAllPlans();
        if (!cancelled) setAllPlans(plans);
      } catch (err) {
        console.error("Failed to fetch plans:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep localPlans in sync with allPlans when not in rearrange mode
  useEffect(() => {
    if (!rearrangeMode) {
      setLocalPlans([...allPlans].sort((a, b) => a.global_week_number - b.global_week_number));
    }
  }, [allPlans, rearrangeMode]);

  const enterRearrange = () => {
    const sorted = [...allPlans].sort((a, b) => a.global_week_number - b.global_week_number);
    originalRef.current = sorted;
    setLocalPlans(sorted);
    setSaveError(null);
    setRearrangeMode(true);
  };

  const cancelRearrange = () => {
    setLocalPlans(originalRef.current);
    setRearrangeMode(false);
    setSaveError(null);
  };

  const handleMove = useCallback((fromIndex: number, toIndex: number) => {
    setLocalPlans((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleDeleteRequest = (plan: WeekPlanSummary) => {
    setConfirmDelete(plan);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePlan(confirmDelete.id);
      const fresh = await fetchAllPlans();
      setAllPlans(fresh);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const saveReorder = async () => {
    setSaving(true);
    setSaveError(null);
    // Send ordered plan IDs — server recomputes all date fields
    const updates: PlanPositionUpdate[] = localPlans.map((plan) => ({
      plan_id: plan.id,
    }));

    try {
      const updated = await reorderPlans(updates);
      setAllPlans(updated);
      setRearrangeMode(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setLocalPlans(originalRef.current);
    } finally {
      setSaving(false);
    }
  };

  // Global sorted list used for 1-based display index in normal view
  const sortedAll = [...allPlans].sort((a, b) => a.global_week_number - b.global_week_number);
  const planDisplayIndex = new Map(sortedAll.map((p, i) => [p.id, i + 1]));

  // Group the display plans by year-month
  const displayPlans = rearrangeMode ? localPlans : sortedAll;

  const grouped = new Map<string, WeekPlanSummary[]>();
  for (const plan of displayPlans) {
    const key = `${plan.year}-${String(plan.month).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(plan);
  }
  const sortedKeys = [...grouped.keys()].sort().reverse();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-white border-b border-border sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="p-2 hover:bg-secondary/20 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl text-foreground">Calendar View</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">All generated plans</p>
                </div>
              </div>

              {/* Rearrange controls */}
              {allPlans.length > 1 && !loading && (
                <div className="flex items-center gap-2">
                  {rearrangeMode ? (
                    <>
                      <button
                        onClick={cancelRearrange}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border hover:bg-muted/50 transition-all disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        onClick={saveReorder}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {saving ? "Saving…" : "Save Order"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={enterRearrange}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border hover:bg-muted/50 transition-all"
                    >
                      <LayoutList className="w-4 h-4" />
                      Rearrange
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Rearrange hint banner */}
            {rearrangeMode && (
              <div className="mt-3 px-3 py-2 bg-primary/8 border border-primary/20 rounded-xl text-sm text-primary">
                Drag week cards to reorder — positions and dates will update on save.
              </div>
            )}

            {saveError && (
              <div className="mt-3 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                {saveError}
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading plans…</p>
            </div>
          ) : allPlans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg text-muted-foreground mb-2">No plans yet</p>
              <p className="text-sm text-muted-foreground">
                Generate your first week plan from the{" "}
                <Link to="/" className="text-primary hover:underline">Dashboard</Link>.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {rearrangeMode ? (
                // In rearrange mode show a flat ordered list (no month grouping)
                // so the user can freely reorder across months
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                    Drag to reorder curriculum sequence
                  </p>
                  {localPlans.map((plan, idx) => (
                    <WeekCard
                      key={plan.id}
                      plan={plan}
                      index={idx}
                      displayIndex={idx + 1}
                      rearrangeMode={rearrangeMode}
                      onMove={handleMove}
                      onDelete={handleDeleteRequest}
                    />
                  ))}
                </div>
              ) : (
                // Normal view: grouped by month
                sortedKeys.map((key) => {
                  const plans = grouped.get(key)!;
                  const firstPlan = plans[0];
                  const monthLabel = `${MONTH_NAMES[firstPlan.month]} ${firstPlan.year}`;
                  return (
                    <div key={key}>
                      <h2 className="text-lg font-medium text-foreground mb-4">{monthLabel}</h2>
                      <div className="space-y-4">
                        {plans
                          .sort((a, b) => (planDisplayIndex.get(a.id) ?? 0) - (planDisplayIndex.get(b.id) ?? 0))
                          .map((plan) => (
                            <WeekCard
                              key={plan.id}
                              plan={plan}
                              index={planDisplayIndex.get(plan.id)! - 1}
                              displayIndex={planDisplayIndex.get(plan.id)!}
                              rearrangeMode={false}
                              onMove={handleMove}
                              onDelete={handleDeleteRequest}
                            />
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>

        <ChatAssistant isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} />

        {/* Delete confirmation dialog */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <h2 className="text-lg font-semibold text-foreground mb-1">Delete plan?</h2>
              <p className="text-sm text-muted-foreground mb-1">
                <strong>{confirmDelete.theme}</strong> will be permanently deleted.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Remaining plans will be renumbered automatically.
              </p>
              {deleteError && (
                <p className="text-sm text-destructive mb-3">{deleteError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted/50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-destructive text-white hover:bg-destructive/90 transition-all disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
