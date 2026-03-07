/**
 * ActivityColorLegend Component
 * 
 * A compact, toggleable legend showing the activity color coding system.
 * Used in the Daily Schedule tab to help teachers quickly identify activity types.
 */

import { Info, X } from "lucide-react";

interface ActivityColorLegendProps {
  isVisible: boolean;
  onToggle: () => void;
}

const categoryColors = {
  circle: {
    dot: "#7A9B76",
    label: "Circle Time",
    emoji: "🟩",
  },
  theme: {
    dot: "#F4B740",
    label: "Theme Activity",
    emoji: "🟨",
  },
  "gross-motor": {
    dot: "#D4845B",
    label: "Gross Motor",
    emoji: "🟧",
  },
  sensory: {
    dot: "#7FABBB",
    label: "Sensory",
    emoji: "🟦",
  },
  "free-play": {
    dot: "#B4A7D6",
    label: "Free Play",
    emoji: "🟪",
  },
  routine: {
    dot: "#B8B8B8",
    label: "Daily Routine",
    emoji: "⚪",
  },
  transition: {
    dot: "#C8B6A6",
    label: "Transition",
    emoji: "⚪",
  },
};

export function ActivityColorLegend({ isVisible, onToggle }: ActivityColorLegendProps) {
  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all shadow-sm"
      >
        <Info className="w-4 h-4" />
        <span>Show Activity Color Key</span>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Activity Color Key</p>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-muted/20 rounded-lg transition-colors"
          aria-label="Hide legend"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Primary Activities */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
          Learning Activities
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {["circle", "theme", "gross-motor", "sensory", "free-play"].map((key) => {
            const config = categoryColors[key as keyof typeof categoryColors];
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                  style={{
                    backgroundColor: config.dot,
                    borderColor: config.dot,
                  }}
                />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Support Activities */}
      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
          Support & Care
        </p>
        <div className="grid grid-cols-2 gap-3">
          {["routine", "transition"].map((key) => {
            const config = categoryColors[key as keyof typeof categoryColors];
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                  style={{
                    backgroundColor: config.dot,
                    borderColor: config.dot,
                  }}
                />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Tip */}
      <div className="mt-4 p-3 bg-muted/10 rounded-xl">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Quick Tip:</strong> Activity colors remain
          consistent across all weekly themes for easy schedule scanning.
        </p>
      </div>
    </div>
  );
}
