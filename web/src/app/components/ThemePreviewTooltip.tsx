/**
 * ThemePreviewTooltip Component
 * 
 * Shows a temporary notification when a theme is being previewed.
 * Helps users understand that colors are updating dynamically.
 */

import { motion, AnimatePresence } from "motion/react";
import { Eye, Sparkles } from "lucide-react";
import { ThemeDetail } from 'shared';

interface ThemePreviewTooltipProps {
  theme: ThemeDetail | null;
}

export function ThemePreviewTooltip({ theme }: ThemePreviewTooltipProps) {
  if (!theme) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        <div
          className="px-5 py-3 rounded-2xl shadow-xl border-2 backdrop-blur-sm flex items-center gap-3"
          style={{
            backgroundColor: theme.palette.hex.background + "F0",
            borderColor: theme.palette.hex.primary,
          }}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.5 }}
          >
            <Eye className="w-5 h-5" style={{ color: theme.palette.hex.primary }} />
          </motion.div>
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <span className="text-xl">{theme.emoji}</span>
              Previewing: {theme.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Colors updating across all tabs
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
