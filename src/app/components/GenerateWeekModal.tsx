import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, ArrowRight, AlertCircle } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeDetail } from "../utils/themeData";
import { ThemeSelectionGrid } from "./ThemeSelectionGrid";
import { usePlanner } from "../contexts/PlannerContext";
import { generateThemes, generatePlan } from "../utils/api";
import { transformApiThemeToThemeDetail, transformApiPlanToWeekPlan } from "../utils/apiTransformers";

interface GenerateWeekModalProps {
  onComplete: () => void;
}

export function GenerateWeekModal({ onComplete }: GenerateWeekModalProps) {
  const [stage, setStage] = useState<
    "generating-themes" | "selection" | "generating-plan" | "error"
  >("generating-themes");
  const { setThemeFromDetail, registerDynamicThemes } = useTheme();
  const { setCurrentPlan, setError: setPlannerError } = usePlanner();
  const [themeOptions, setThemeOptions] = useState<ThemeDetail[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isShuffling, setIsShuffling] = useState(false);
  const abortRef = useRef(false);

  // Raw API themes kept for sending back to planner
  const [rawApiThemes, setRawApiThemes] = useState<Record<string, unknown>[]>([]);

  const fetchThemes = async () => {
    try {
      const data = await generateThemes();
      if (abortRef.current) return;

      // data is an array of theme objects directly
      const apiThemes = Array.isArray(data) ? data : (data as any).themes ?? data;
      setRawApiThemes(apiThemes as Record<string, unknown>[]);

      const transformed = (apiThemes as Record<string, unknown>[]).map(transformApiThemeToThemeDetail);
      setThemeOptions(transformed);
      registerDynamicThemes(transformed);

      if (transformed.length > 0) {
        setSelectedThemeId(transformed[0].id);
        setThemeFromDetail(transformed[0]);
      }
      setStage("selection");
    } catch (err: any) {
      if (abortRef.current) return;
      setErrorMsg(err.message ?? "Failed to generate themes");
      setStage("error");
    }
  };

  useEffect(() => {
    abortRef.current = false;
    fetchThemes();
    return () => { abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    const detail = themeOptions.find((t) => t.id === themeId);
    if (detail) setThemeFromDetail(detail);
  };

  const handleShuffle = async () => {
    setIsShuffling(true);
    try {
      const data = await generateThemes();
      const apiThemes = Array.isArray(data) ? data : (data as any).themes ?? data;
      setRawApiThemes(apiThemes as Record<string, unknown>[]);

      const transformed = (apiThemes as Record<string, unknown>[]).map(transformApiThemeToThemeDetail);
      setThemeOptions(transformed);
      registerDynamicThemes(transformed);

      if (transformed.length > 0) {
        setSelectedThemeId(transformed[0].id);
        setThemeFromDetail(transformed[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to generate themes");
      setStage("error");
    } finally {
      setIsShuffling(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedThemeId) return;

    // Find the raw API theme to send to the planner
    const idx = themeOptions.findIndex((t) => t.id === selectedThemeId);
    const rawTheme = rawApiThemes[idx] ?? {};

    setStage("generating-plan");
    try {
      const result = await generatePlan({
        selectedTheme: rawTheme,
        weekNumber: 1,
        weekRange: "",
      });

      const plan = transformApiPlanToWeekPlan(result.plan);
      setCurrentPlan(plan);
      setPlannerError(null);
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to generate plan");
      setPlannerError(err.message ?? "Failed to generate plan");
      setStage("error");
    }
  };

  const handleRetry = () => {
    setErrorMsg("");
    setStage("generating-themes");
    fetchThemes();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        {/* ── Generating Themes spinner ── */}
        {stage === "generating-themes" && (
          <motion.div
            key="generating-themes"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-auto"
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
                Generating theme options…
              </h3>
              <p className="text-sm text-muted-foreground">
                AI is crafting personalised themes for your classroom
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
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-auto"
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
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors"
              >
                Try Again
              </button>
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
                <div>
                  <h2 className="text-2xl font-medium text-foreground mb-2">
                    Choose Your Weekly Theme
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Select a theme to shape this week's activities, songs, and materials
                  </p>
                </div>
                <button
                  onClick={handleShuffle}
                  disabled={isShuffling}
                  className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 text-foreground ${isShuffling ? "animate-spin" : ""}`} />
                  <span className="text-sm font-medium text-foreground hidden sm:inline">
                    {isShuffling ? "Generating…" : "Shuffle Themes"}
                  </span>
                </button>
              </div>
            </div>

            {/* Theme Selection Grid */}
            <div className="p-6">
              <ThemeSelectionGrid
                themes={themeOptions}
                selectedThemeId={selectedThemeId || undefined}
                onSelectTheme={handleSelectTheme}
              />
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-border p-6 rounded-b-3xl">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {selectedThemeId && (
                    <>
                      <strong className="text-foreground">Selected:</strong>{" "}
                      {themeOptions.find((t) => t.id === selectedThemeId)?.name}
                    </>
                  )}
                </p>
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
