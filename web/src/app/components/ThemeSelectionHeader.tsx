/**
 * ThemeSelectionHeader Component
 * 
 * Compact theme selection shown at the top of weekly plan.
 * Allows teachers to change themes even after initial selection.
 */

import { motion } from "motion/react";
import { RefreshCw, ChevronDown, ChevronUp, Loader2, ArrowRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { ThemeDetail, fetchThemePool, transformApiThemeToThemeDetail } from 'shared';
import { ThemeSelectionGrid } from "./ThemeSelectionGrid";

interface ThemeSelectionHeaderProps {
  currentTheme: ThemeDetail;
  onThemeChange: (theme: ThemeDetail, poolThemeUuid: string) => void;
  weekNumber: number;
  weekRange: string;
  swapLoading?: boolean;
}

export function ThemeSelectionHeader({
  currentTheme,
  onThemeChange,
  weekNumber,
  weekRange,
  swapLoading = false,
}: ThemeSelectionHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const [poolThemes, setPoolThemes] = useState<ThemeDetail[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [selectedPoolTheme, setSelectedPoolTheme] = useState<ThemeDetail | null>(null);
  // Map ThemeDetail.id → backend pool UUID
  const [poolIdMap, setPoolIdMap] = useState<Map<string, string>>(new Map());

  // Preview the selected pool theme's colors on the box; revert to currentTheme otherwise
  const displayTheme = (isExpanded && selectedPoolTheme) ? selectedPoolTheme : currentTheme;

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const resp = await fetchThemePool();
      const idMap = new Map<string, string>();
      const transformed = resp.themes.map((item) => {
        const detail = transformApiThemeToThemeDetail(item.theme_data);
        idMap.set(detail.id, item.id);
        return detail;
      });
      setPoolThemes(transformed);
      setPoolIdMap(idMap);
    } catch (err) {
      console.error("Failed to load theme pool:", err);
    } finally {
      setPoolLoading(false);
    }
  }, []);

  // Fetch pool when sidebar expands
  useEffect(() => {
    if (isExpanded && poolThemes.length === 0) {
      loadPool();
    }
  }, [isExpanded, poolThemes.length, loadPool]);

  const handleShuffle = async () => {
    let themes = poolThemes;
    if (themes.length === 0) {
      setPoolLoading(true);
      try {
        const resp = await fetchThemePool();
        const idMap = new Map<string, string>();
        themes = resp.themes.map((item) => {
          const detail = transformApiThemeToThemeDetail(item.theme_data);
          idMap.set(detail.id, item.id);
          return detail;
        });
        setPoolThemes(themes);
        setPoolIdMap(idMap);
      } catch {
        return;
      } finally {
        setPoolLoading(false);
      }
    }
    const otherThemes = themes.filter((t) => t.id !== currentTheme.id);
    if (otherThemes.length === 0) return;
    const randomTheme = otherThemes[Math.floor(Math.random() * otherThemes.length)];
    setSelectedPoolTheme(randomTheme);
    setIsExpanded(true);
  };

  const handleConfirmSwap = () => {
    if (!selectedPoolTheme) return;
    const poolUuid = poolIdMap.get(selectedPoolTheme.id);
    if (!poolUuid) return;
    onThemeChange(selectedPoolTheme, poolUuid);
  };

  return (
    <div className="mb-6">
      {/* Compact Theme Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 overflow-hidden theme-transition shadow-sm"
        style={{
          borderColor: displayTheme.palette.hex.primary,
          backgroundColor: displayTheme.palette.hex.background,
        }}
      >
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Theme Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-3xl flex-shrink-0">{displayTheme.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-medium text-foreground truncate">
                    {displayTheme.name}
                  </h2>
                  <div className="flex gap-1">
                    {Object.entries(displayTheme.palette.hex)
                      .filter(([key]) => key !== "background")
                      .slice(0, 3)
                      .map(([key, color]) => (
                        <div
                          key={key}
                          className="w-4 h-4 rounded border border-white shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Week {weekNumber} • {weekRange}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShuffle}
                className="flex items-center gap-2 px-3 py-2 bg-white border rounded-xl transition-all hover:shadow-md text-sm font-medium"
                style={{
                  borderColor: displayTheme.palette.hex.primary + "40",
                  color: displayTheme.palette.hex.primary,
                }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Change Theme</span>
              </button>
              <button
                onClick={() => {
                  const next = !isExpanded;
                  setIsExpanded(next);
                  if (!next) setSelectedPoolTheme(null);
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl transition-all hover:bg-white/50 text-sm font-medium"
                style={{ color: displayTheme.palette.hex.primary }}
              >
                <span className="hidden sm:inline">
                  {isExpanded ? "Hide" : "Show"} Options
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Mood Tags */}
          <div className="flex flex-wrap gap-2 mt-3">
            {displayTheme.atmosphere.slice(0, 3).map((mood) => (
              <span
                key={mood}
                className="px-2 py-1 rounded-lg text-xs font-medium border"
                style={{
                  backgroundColor: displayTheme.palette.hex.secondary + "20",
                  borderColor: displayTheme.palette.hex.secondary + "30",
                  color: displayTheme.palette.hex.secondary,
                }}
              >
                {mood}
              </span>
            ))}
          </div>
        </div>

        {/* Expanded Theme Selection */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-border p-6 bg-white"
          >
            <h3 className="text-sm font-medium text-foreground mb-4">
              Choose a Different Theme
            </h3>
            {poolLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading themes…</span>
              </div>
            ) : (
              <ThemeSelectionGrid
                themes={poolThemes}
                selectedThemeId={selectedPoolTheme?.id ?? currentTheme.id}
                enableHoverPreview={false}
                onSelectTheme={(themeId) => {
                  const selected = poolThemes.find((t) => t.id === themeId);
                  if (selected) setSelectedPoolTheme(selected);
                }}
              />
            )}

            {/* Confirmation footer */}
            {selectedPoolTheme && selectedPoolTheme.id !== currentTheme.id && (
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Selected:</strong>{" "}
                  {selectedPoolTheme.emoji} {selectedPoolTheme.name}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPoolTheme(null)}
                    className="px-3 py-2 text-sm font-medium rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSwap}
                    disabled={swapLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                    style={{ backgroundColor: selectedPoolTheme.palette.hex.primary }}
                  >
                    {swapLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {swapLoading ? "Swapping…" : "Change Theme"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
