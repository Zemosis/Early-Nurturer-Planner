import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { themeLibrary, ThemeDetail } from "../utils/themeData";
import { ThemeSelectionGrid } from "./ThemeSelectionGrid";

interface GenerateWeekModalProps {
  onComplete: () => void;
}

// Helper to get random themes
const getRandomThemes = (count: number = 5): ThemeDetail[] => {
  const shuffled = [...themeLibrary].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export function GenerateWeekModal({ onComplete }: GenerateWeekModalProps) {
  const [stage, setStage] = useState<"generating" | "selection">("generating");
  const { setTheme } = useTheme();
  const [themeOptions, setThemeOptions] = useState<ThemeDetail[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  useEffect(() => {
    // Generate initial theme options
    const initialThemes = getRandomThemes(5);
    setThemeOptions(initialThemes);
    setSelectedThemeId(initialThemes[0].id);
    setTheme(initialThemes[0].id);

    // Transition to selection after generating
    const timer = setTimeout(() => {
      setStage("selection");
    }, 2000);

    return () => clearTimeout(timer);
  }, [setTheme]);

  const handleSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    setTheme(themeId);
  };

  const handleShuffle = () => {
    const newThemes = getRandomThemes(5);
    setThemeOptions(newThemes);
    setSelectedThemeId(newThemes[0].id);
    setTheme(newThemes[0].id);
  };

  const handleContinue = () => {
    if (selectedThemeId) {
      setTheme(selectedThemeId);
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        {stage === "generating" && (
          <motion.div
            key="generating"
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
                Creating weekly curriculum with multiple theme choices
              </p>
            </div>
          </motion.div>
        )}

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
                  className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted rounded-xl transition-all hover:shadow-md"
                >
                  <RefreshCw className="w-4 h-4 text-foreground" />
                  <span className="text-sm font-medium text-foreground hidden sm:inline">
                    Shuffle Themes
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
                  <span>Continue to Week Plan</span>
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
