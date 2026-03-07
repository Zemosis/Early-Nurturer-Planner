/**
 * ThemeTransitionIndicator Component
 * 
 * Subtle visual feedback when theme colors are transitioning.
 * Shows a small animated indicator during the 350ms color transition.
 */

import { motion, AnimatePresence } from "motion/react";
import { Palette } from "lucide-react";

interface ThemeTransitionIndicatorProps {
  isTransitioning: boolean;
}

export function ThemeTransitionIndicator({ isTransitioning }: ThemeTransitionIndicatorProps) {
  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50"
        >
          <div className="bg-white rounded-xl shadow-lg border border-border px-4 py-2.5 flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Palette className="w-4 h-4" style={{ color: "var(--theme-primary)" }} />
            </motion.div>
            <span className="text-sm font-medium text-foreground">
              Applying theme colors...
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
