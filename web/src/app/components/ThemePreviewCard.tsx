/**
 * ThemePreviewCard Component
 * 
 * Immersive theme preview shown at the top of newly generated weekly plans.
 * Helps teachers immediately feel the week's mood and visual identity.
 */

import { motion } from "motion/react";
import { RefreshCw, Check, Sparkles } from "lucide-react";
import { ThemeDetail } from 'shared';

interface ThemePreviewCardProps {
  theme: ThemeDetail;
  weekNumber: number;
  weekRange: string;
  onRefresh?: () => void;
  onAccept?: () => void;
  showActions?: boolean;
}

// Theme-specific subtle illustrations using CSS
const themePatterns: Record<string, string> = {
  "fox-forest": "🦊 🌲 🍂",
  "gentle-rain": "🌧️ 💧 ☁️",
  "garden-friends": "🌼 🌻 🐛",
  "woodland-trees": "🌲 🌳 🍃",
  "ocean-waves": "🌊 🐚 🐠",
};

export function ThemePreviewCard({
  theme,
  weekNumber,
  weekRange,
  onRefresh,
  onAccept,
  showActions = false,
}: ThemePreviewCardProps) {
  const pattern = themePatterns[theme.id] || "✨";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl shadow-lg border-2 theme-transition mb-6"
      style={{
        borderColor: theme.palette.hex.primary,
        backgroundColor: theme.palette.hex.background,
      }}
    >
      {/* Decorative Pattern Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-4 right-4 text-6xl">{pattern.split(" ")[0]}</div>
        <div className="absolute bottom-8 left-8 text-5xl">{pattern.split(" ")[1]}</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl opacity-30">
          {pattern.split(" ")[2]}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-6 md:p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
          {/* Theme Identity */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="text-5xl"
              >
                {theme.emoji}
              </motion.span>
              <div>
                <h2 className="text-2xl md:text-3xl font-medium text-foreground mb-1">
                  {theme.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Week {weekNumber} • {weekRange}
                </p>
              </div>
            </div>

            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{
                backgroundColor: theme.palette.hex.primary + "15",
                color: theme.palette.hex.primary,
              }}
            >
              <Sparkles className="w-4 h-4" />
              <p className="text-sm font-medium">
                Everything this week revolves around {theme.name}!
              </p>
            </motion.div>
          </div>

          {/* Action Buttons */}
          {showActions && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium transition-all hover:shadow-md hover:scale-105"
                  style={{
                    borderColor: theme.palette.hex.primary,
                    color: theme.palette.hex.primary,
                    backgroundColor: "white",
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Try Another Theme</span>
                </button>
              )}
              {onAccept && (
                <button
                  onClick={onAccept}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all hover:shadow-md hover:scale-105 text-white"
                  style={{
                    backgroundColor: theme.palette.hex.primary,
                  }}
                >
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Accept Theme</span>
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* Mood & Palette Section */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Mood Descriptors */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3 font-medium">
              Weekly Mood
            </p>
            <div className="flex flex-wrap gap-2">
              {theme.atmosphere.map((mood, index) => (
                <motion.span
                  key={mood}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border theme-transition"
                  style={{
                    backgroundColor: theme.palette.hex.secondary + "20",
                    borderColor: theme.palette.hex.secondary + "40",
                    color: theme.palette.hex.secondary,
                  }}
                >
                  {mood}
                </motion.span>
              ))}
            </div>
          </div>

          {/* Color Palette Preview */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3 font-medium">
              Color Palette
            </p>
            <div className="flex gap-3">
              {Object.entries(theme.palette.hex)
                .filter(([key]) => key !== "background")
                .map(([key, color], index) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex-1"
                  >
                    <div
                      className="h-16 rounded-xl border-2 border-white shadow-sm mb-2 transition-transform hover:scale-105"
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-xs text-muted-foreground text-center capitalize">
                      {theme.palette[key as keyof typeof theme.palette] as string}
                    </p>
                  </motion.div>
                ))}
            </div>
          </div>
        </div>

        {/* Visual Direction */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6 pt-6 border-t"
          style={{ borderColor: theme.palette.hex.primary + "20" }}
        >
          <p className="text-sm text-muted-foreground italic">
            "{theme.mood}"
          </p>
        </motion.div>
      </div>

      {/* Subtle Gradient Overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${theme.palette.hex.primary}00 0%, ${theme.palette.hex.accent}30 100%)`,
        }}
      />
    </motion.div>
  );
}
