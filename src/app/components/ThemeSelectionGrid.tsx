/**
 * ThemeSelectionGrid Component
 * 
 * Displays multiple theme options for teachers to preview and select.
 * Each theme card shows colors, mood, and visual identity.
 */

import { motion, AnimatePresence } from "motion/react";
import { Check, Sparkles, Eye, Bookmark } from "lucide-react";
import { useState } from "react";
import { ThemeDetail } from "../utils/themeData";
import { useTheme } from "../contexts/ThemeContext";

interface ThemeSelectionGridProps {
  themes: ThemeDetail[];
  selectedThemeId?: string;
  onSelectTheme: (themeId: string) => void;
  enableHoverPreview?: boolean;
  keepMode?: boolean;
  keepSet?: Set<string>;
  skeletonCount?: number;
}

export function ThemeSelectionGrid({
  themes,
  selectedThemeId,
  onSelectTheme,
  enableHoverPreview = true,
  keepMode = false,
  keepSet,
  skeletonCount = 0,
}: ThemeSelectionGridProps) {
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const { previewTheme } = useTheme();

  const handleMouseEnter = (themeId: string) => {
    if (enableHoverPreview && themeId !== selectedThemeId) {
      setPreviewThemeId(themeId);
      previewTheme(themeId);
    }
  };

  const handleMouseLeave = () => {
    setPreviewThemeId(null);
    previewTheme(null);
  };

  const handleClick = (themeId: string) => {
    setPreviewThemeId(null);
    previewTheme(null);
    onSelectTheme(themeId);
  };

  return (
    <div>
      {/* Preview Indicator */}
      <AnimatePresence>
        {previewThemeId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center justify-center gap-2 px-4 py-2 bg-secondary/10 border border-secondary/20 rounded-xl"
          >
            <Eye className="w-4 h-4 text-secondary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Previewing:</strong>{" "}
              {themes.find((t) => t.id === previewThemeId)?.name}
            </p>
            <p className="text-xs text-muted-foreground italic">
              (Colors updating across all tabs)
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((theme, index) => {
          const isSelected = theme.id === selectedThemeId;
          const isKept = keepMode && keepSet?.has(theme.id);

          return (
            <motion.button
              key={theme.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              onClick={() => handleClick(theme.id)}
              onMouseEnter={() => handleMouseEnter(theme.id)}
              onMouseLeave={handleMouseLeave}
              className={`
                relative rounded-2xl border-2 p-5 text-left transition-all duration-300
                hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                ${
                  isKept
                    ? "ring-4 ring-offset-2 shadow-xl"
                    : isSelected
                      ? "ring-4 ring-offset-2 shadow-xl"
                      : "hover:border-opacity-60"
                }
              `}
              style={{
                backgroundColor: theme.palette.hex.background,
                borderColor: isKept
                  ? theme.palette.hex.accent
                  : isSelected
                    ? theme.palette.hex.primary
                    : theme.palette.hex.primary + "40",
                ringColor: isKept
                  ? theme.palette.hex.accent + "30"
                  : isSelected
                    ? theme.palette.hex.primary + "30"
                    : "transparent",
              }}
            >
              {/* Selected / Kept Indicator */}
              {isKept && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: theme.palette.hex.accent }}
                >
                  <Bookmark className="w-4 h-4" />
                </motion.div>
              )}
              {!keepMode && isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: theme.palette.hex.primary }}
                >
                  <Check className="w-4 h-4" />
                </motion.div>
              )}

              {/* Decorative Background Pattern */}
              <div
                className="absolute bottom-2 right-2 text-5xl opacity-[0.07] pointer-events-none"
                aria-hidden="true"
              >
                {theme.emoji}
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{theme.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-foreground truncate">
                    {theme.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Letter {theme.letter} • {theme.shape}
                  </p>
                </div>
              </div>

              {/* Tagline */}
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-4"
                style={{
                  backgroundColor: theme.palette.hex.secondary + "20",
                  color: theme.palette.hex.secondary,
                }}
              >
                <Sparkles className="w-3 h-3" />
                <p className="text-xs font-medium">
                  {theme.atmosphere[0]} & {theme.atmosphere[1]}
                </p>
              </div>

              {/* Color Palette */}
              <div className="mb-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">
                  Color Palette
                </p>
                <div className="flex gap-2">
                  {Object.entries(theme.palette.hex)
                    .filter(([key]) => key !== "background")
                    .map(([key, color]) => (
                      <div
                        key={key}
                        className="w-10 h-10 rounded-lg border-2 border-white shadow-sm flex-1"
                        style={{ backgroundColor: color }}
                        title={theme.palette[key as keyof typeof theme.palette] as string}
                      />
                    ))}
                </div>
              </div>

              {/* Mood Quote */}
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                "{theme.mood}"
              </p>

              {/* Hover Overlay */}
              <div
                className={`
                  absolute inset-0 rounded-2xl pointer-events-none transition-opacity
                  ${isSelected ? "opacity-0" : "opacity-0 group-hover:opacity-10"}
                `}
                style={{
                  background: `linear-gradient(135deg, ${theme.palette.hex.primary}30 0%, ${theme.palette.hex.accent}30 100%)`,
                }}
              />
            </motion.button>
          );
        })}

        {/* Skeleton placeholder cards for themes being generated */}
        {Array.from({ length: Math.max(0, skeletonCount) }).map((_, i) => (
          <motion.div
            key={`skeleton-${i}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (themes.length + i) * 0.1, duration: 0.3 }}
            className="relative rounded-2xl border-2 border-dashed border-muted-foreground/20 p-5 bg-muted/30"
          >
            {/* Pulsing shimmer overlay */}
            <div className="animate-pulse space-y-4">
              {/* Header skeleton */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted-foreground/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted-foreground/10" />
                  <div className="h-3 w-1/2 rounded bg-muted-foreground/10" />
                </div>
              </div>

              {/* Tagline skeleton */}
              <div className="h-6 w-2/3 rounded-lg bg-muted-foreground/10" />

              {/* Palette skeleton */}
              <div className="space-y-2">
                <div className="h-3 w-1/3 rounded bg-muted-foreground/10" />
                <div className="flex gap-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="w-10 h-10 rounded-lg bg-muted-foreground/10 flex-1" />
                  ))}
                </div>
              </div>

              {/* Mood skeleton */}
              <div className="h-3 w-full rounded bg-muted-foreground/10" />
            </div>

            {/* Centered generating label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-full shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
                <span className="text-xs font-medium text-muted-foreground">Generating…</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}