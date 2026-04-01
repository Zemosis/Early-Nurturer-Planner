import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, ArrowRight, AlertCircle, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeDetail } from "../utils/themeData";
import { ThemeSelectionGrid } from "./ThemeSelectionGrid";
import { usePlanner } from "../contexts/PlannerContext";
import { fetchThemePool, refreshThemePool, generatePlan, ThemePoolItem } from "../utils/api";
import { transformApiThemeToThemeDetail, transformApiPlanToWeekPlan } from "../utils/apiTransformers";

const POLL_INTERVAL_MS = 3000;

interface GenerateWeekModalProps {
  onComplete: (planId?: string) => void;
  onClose?: () => void;
}

export function GenerateWeekModal({ onComplete, onClose }: GenerateWeekModalProps) {
  const [stage, setStage] = useState<
    "loading-pool" | "selection" | "generating-plan" | "error"
  >("loading-pool");
  const { setThemeFromDetail, registerDynamicThemes } = useTheme();
  const { setCurrentPlan, setCurrentPlanId, setError: setPlannerError, themePool, setThemePool } = usePlanner();
  const [themeOptions, setThemeOptions] = useState<ThemeDetail[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [keepMode, setKeepMode] = useState(false);
  const [keepSet, setKeepSet] = useState<Set<string>>(new Set());
  const abortRef = useRef(false);
  const [isPoolGenerating, setIsPoolGenerating] = useState(false);
  const [poolSize, setPoolSize] = useState(5);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map from ThemeDetail.id → pool item UUID for sending to backend
  const [poolIdMap, setPoolIdMap] = useState<Map<string, string>>(new Map());

  const applyPoolToState = useCallback((pool: ThemePoolItem[], preserveSelection = false) => {
    setThemePool(pool);

    const idMap = new Map<string, string>();
    const transformed = pool.map((item) => {
      const detail = transformApiThemeToThemeDetail(item.theme_data);
      idMap.set(detail.id, item.id);
      return detail;
    });
    setPoolIdMap(idMap);
    setThemeOptions(transformed);
    registerDynamicThemes(transformed);

    if (!preserveSelection && transformed.length > 0) {
      setSelectedThemeId(transformed[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollPool = useCallback(async () => {
    try {
      const resp = await fetchThemePool();
      if (abortRef.current) return;
      applyPoolToState(resp.themes, true);
      setPoolSize(resp.pool_size);
      if (resp.generating) {
        setIsPoolGenerating(true);
        pollTimerRef.current = setTimeout(pollPool, POLL_INTERVAL_MS);
      } else {
        setIsPoolGenerating(false);
      }
    } catch {
      // Silently retry on next interval
      if (!abortRef.current) {
        pollTimerRef.current = setTimeout(pollPool, POLL_INTERVAL_MS);
      }
    }
  }, [applyPoolToState]);

  const loadPool = async () => {
    try {
      const resp = await fetchThemePool();
      if (abortRef.current) return;
      applyPoolToState(resp.themes);
      setPoolSize(resp.pool_size);
      setStage("selection");

      // If backend is still generating, start polling
      if (resp.generating) {
        setIsPoolGenerating(true);
        pollTimerRef.current = setTimeout(pollPool, POLL_INTERVAL_MS);
      }
    } catch (err: any) {
      if (abortRef.current) return;
      setErrorMsg(err.message ?? "Failed to load themes");
      setStage("error");
    }
  };

  useEffect(() => {
    abortRef.current = false;
    loadPool();
    return () => {
      abortRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTheme = (themeId: string) => {
    if (keepMode) {
      // In keep mode, toggle the keep status
      setKeepSet((prev) => {
        const next = new Set(prev);
        if (next.has(themeId)) next.delete(themeId);
        else next.add(themeId);
        return next;
      });
      return;
    }
    setSelectedThemeId(themeId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Convert kept ThemeDetail IDs → pool UUIDs
      const keepPoolIds = Array.from(keepSet)
        .map((detailId) => poolIdMap.get(detailId))
        .filter(Boolean) as string[];

      const resp = await refreshThemePool(keepPoolIds);
      applyPoolToState(resp.themes);
      setPoolSize(resp.pool_size);
      setKeepMode(false);
      setKeepSet(new Set());
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to refresh themes");
      setStage("error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedThemeId) return;

    // Find the raw theme data and pool UUID
    const idx = themeOptions.findIndex((t) => t.id === selectedThemeId);
    const poolItem = themePool[idx];
    const rawTheme = poolItem?.theme_data ?? {};
    const poolUuid = poolIdMap.get(selectedThemeId);

    // Commit the selected theme to global context NOW (user confirmed)
    const selectedDetail = themeOptions.find((t) => t.id === selectedThemeId);
    if (selectedDetail) setThemeFromDetail(selectedDetail);

    setStage("generating-plan");
    try {
      const result = await generatePlan({
        selectedTheme: rawTheme,
        themePoolId: poolUuid,
      });

      const plan = transformApiPlanToWeekPlan({ ...result.plan, id: result.plan_id });
      setCurrentPlan(plan);
      setCurrentPlanId(result.plan_id ?? null);
      setPlannerError(null);
      onComplete(result.plan_id ?? undefined);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to generate plan");
      setPlannerError(err.message ?? "Failed to generate plan");
      setStage("error");
    }
  };

  const handleRetry = () => {
    setErrorMsg("");
    setStage("loading-pool");
    loadPool();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        {/* ── Loading Pool spinner ── */}
        {stage === "loading-pool" && (
          <motion.div
            key="loading-pool"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-auto relative"
          >
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 hover:bg-muted/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4 theme-transition"
                style={{ backgroundColor: "var(--theme-primary-light)" }}
              >
                <Sparkles
                  className="w-8 h-8 theme-transition"
                  style={{ color: "var(--theme-primary)" }}
                />
              </motion.div>
              <h3 className="text-xl font-medium text-foreground mb-2">
                Loading your theme pool…
              </h3>
              <p className="text-sm text-muted-foreground">
                Fetching personalised themes for your classroom
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Generating Plan spinner ── */}
        {stage === "generating-plan" && (
          <motion.div
            key="generating-plan"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-auto relative"
          >
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4 theme-transition"
                style={{ backgroundColor: "var(--theme-primary-light)" }}
              >
                <Sparkles
                  className="w-8 h-8 theme-transition"
                  style={{ color: "var(--theme-primary)" }}
                />
              </motion.div>
              <h3 className="text-xl font-medium text-foreground mb-2">
                Building your curriculum…
              </h3>
              <p className="text-sm text-muted-foreground">
                Architect → Auditor → Personalizer pipeline is running.
                <br />
                This may take up to 2 minutes.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Error state ── */}
        {stage === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-auto"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-red-50">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">
                Something went wrong
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {errorMsg}
              </p>
              <div className="flex gap-3">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-muted/40 hover:bg-muted/60 rounded-xl font-medium transition-colors"
                  >
                    Close
                  </button>
                )}
                <button
                  onClick={handleRetry}
                  className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Theme Selection ── */}
        {stage === "selection" && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-border p-6 z-10 rounded-t-3xl">
              <div className="flex items-start justify-between gap-4">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-muted/20 rounded-lg transition-colors flex-shrink-0 mt-1"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-medium text-foreground mb-2">
                    {keepMode ? "Keep Your Favorites" : "Choose Your Weekly Theme"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {keepMode
                      ? "Click themes you want to keep, then hit Refresh to replace the rest"
                      : "Select a theme to shape this week's activities, songs, and materials"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {keepMode ? (
                    <>
                      <button
                        onClick={() => { setKeepMode(false); setKeepSet(new Set()); }}
                        className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted rounded-xl transition-all text-sm font-medium text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all disabled:opacity-50 text-sm font-medium"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        {isRefreshing ? "Refreshing…" : `Refresh (keep ${keepSet.size})`}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setKeepMode(true)}
                      disabled={isPoolGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted rounded-xl transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 text-foreground ${isPoolGenerating ? "animate-spin" : ""}`} />
                      <span className="text-sm font-medium text-foreground hidden sm:inline">
                        {isPoolGenerating ? "Generating…" : "Don't like these?"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Theme Selection Grid */}
            <div className="p-6 relative">
              {keepMode && (
                <div className="absolute inset-0 z-10 pointer-events-none" />
              )}
              <ThemeSelectionGrid
                themes={themeOptions}
                selectedThemeId={keepMode ? undefined : (selectedThemeId || undefined)}
                onSelectTheme={handleSelectTheme}
                keepMode={keepMode}
                keepSet={keepSet}
                skeletonCount={isPoolGenerating ? poolSize - themeOptions.length : 0}
              />
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-border p-6 rounded-b-3xl">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {keepMode ? (
                    <span>{keepSet.size} theme{keepSet.size !== 1 ? "s" : ""} kept — {themeOptions.length - keepSet.size} will be replaced</span>
                  ) : selectedThemeId ? (
                    <>
                      <strong className="text-foreground">Selected:</strong>{" "}
                      {themeOptions.find((t) => t.id === selectedThemeId)?.name}
                    </>
                  ) : null}
                </p>
                {!keepMode && (
                  <button
                    onClick={handleContinue}
                    disabled={!selectedThemeId}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    style={{
                      backgroundColor: selectedThemeId
                        ? themeOptions.find((t) => t.id === selectedThemeId)?.palette.hex
                            .primary
                        : "#ccc",
                    }}
                  >
                    <span>Generate Week Plan</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
