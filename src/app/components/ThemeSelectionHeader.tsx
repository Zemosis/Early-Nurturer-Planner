/**
 * ThemeSelectionHeader Component
 * 
 * Compact theme selection shown at the top of weekly plan.
 * Allows teachers to change themes even after initial selection.
 */

import { motion } from "motion/react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { ThemeDetail, themeLibrary } from "../utils/themeData";
import { ThemeSelectionGrid } from "./ThemeSelectionGrid";

interface ThemeSelectionHeaderProps {
  currentTheme: ThemeDetail;
  onThemeChange: (themeId: string) => void;
  weekNumber: number;
  weekRange: string;
}

export function ThemeSelectionHeader({
  currentTheme,
  onThemeChange,
  weekNumber,
  weekRange,
}: ThemeSelectionHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleShuffle = () => {
    const otherThemes = themeLibrary.filter((t) => t.id !== currentTheme.id);
    const randomTheme = otherThemes[Math.floor(Math.random() * otherThemes.length)];
    onThemeChange(randomTheme.id);
  };

  return (
    <div className="mb-6">
      {/* Compact Theme Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 overflow-hidden theme-transition shadow-sm"
        style={{
          borderColor: currentTheme.palette.hex.primary,
          backgroundColor: currentTheme.palette.hex.background,
        }}
      >
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Theme Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-3xl flex-shrink-0">{currentTheme.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-medium text-foreground truncate">
                    {currentTheme.name}
                  </h2>
                  <div className="flex gap-1">
                    {Object.entries(currentTheme.palette.hex)
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
                  borderColor: currentTheme.palette.hex.primary + "40",
                  color: currentTheme.palette.hex.primary,
                }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Change Theme</span>
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl transition-all hover:bg-white/50 text-sm font-medium"
                style={{ color: currentTheme.palette.hex.primary }}
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
            {currentTheme.atmosphere.slice(0, 3).map((mood) => (
              <span
                key={mood}
                className="px-2 py-1 rounded-lg text-xs font-medium border"
                style={{
                  backgroundColor: currentTheme.palette.hex.secondary + "20",
                  borderColor: currentTheme.palette.hex.secondary + "30",
                  color: currentTheme.palette.hex.secondary,
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
            <ThemeSelectionGrid
              themes={themeLibrary}
              selectedThemeId={currentTheme.id}
              onSelectTheme={(themeId) => {
                onThemeChange(themeId);
                setIsExpanded(false);
              }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
