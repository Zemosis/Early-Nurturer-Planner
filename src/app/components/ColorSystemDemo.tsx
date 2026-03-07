/**
 * ColorSystemDemo Component
 * 
 * Visual demonstration of the two color systems used in the app:
 * 1. Theme Colors (dynamic, changes weekly)
 * 2. Activity Colors (fixed, for schedule clarity)
 * 
 * Can be used in help documentation or onboarding flows.
 */

import { Palette, Calendar } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export function ColorSystemDemo() {
  const { currentTheme } = useTheme();

  const activityColors = [
    { name: "Circle Time", color: "#7A9B76", emoji: "🟩" },
    { name: "Theme Activity", color: "#F4B740", emoji: "🟨" },
    { name: "Gross Motor", color: "#D4845B", emoji: "🟧" },
    { name: "Sensory", color: "#7FABBB", emoji: "🟦" },
    { name: "Free Play", color: "#B4A7D6", emoji: "🟪" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-medium text-foreground mb-2">
          Understanding Our Color Systems
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          The Early Nurturer Planner uses two complementary color systems to create an
          intuitive and engaging experience.
        </p>
      </div>

      {/* Two Column Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Theme Colors */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5" style={{ color: "var(--theme-primary)" }} />
            <h3 className="font-medium text-foreground">Theme Colors</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Change weekly to match your curriculum theme. Creates an immersive learning
            atmosphere.
          </p>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border border-border"
                style={{ backgroundColor: "var(--theme-primary)" }}
              />
              <div>
                <p className="text-xs font-medium text-foreground">Primary</p>
                <p className="text-xs text-muted-foreground">Buttons, CTAs</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border border-border"
                style={{ backgroundColor: "var(--theme-secondary)" }}
              />
              <div>
                <p className="text-xs font-medium text-foreground">Secondary</p>
                <p className="text-xs text-muted-foreground">Tags, badges</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border border-border"
                style={{ backgroundColor: "var(--theme-accent)" }}
              />
              <div>
                <p className="text-xs font-medium text-foreground">Accent</p>
                <p className="text-xs text-muted-foreground">Highlights</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border border-border"
                style={{ backgroundColor: "var(--theme-background)" }}
              />
              <div>
                <p className="text-xs font-medium text-foreground">Background</p>
                <p className="text-xs text-muted-foreground">Soft tints</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-muted/10 rounded-xl">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Current Theme:</strong>{" "}
              {currentTheme.name} {currentTheme.emoji}
            </p>
          </div>
        </div>

        {/* Activity Colors */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground">Activity Colors</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Stay the same every week. Help you quickly identify activity types in your
            daily schedule.
          </p>

          <div className="space-y-3 mb-4">
            {activityColors.map((activity) => (
              <div key={activity.name} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg border-2"
                  style={{
                    backgroundColor: activity.color + "15",
                    borderColor: activity.color,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm">{activity.emoji}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{activity.name}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-muted/10 rounded-xl">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Consistency:</strong> These colors never
              change, making schedule scanning quick and intuitive.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Examples */}
      <div className="bg-gradient-to-br from-muted/20 to-background rounded-2xl p-8">
        <h3 className="font-medium text-foreground mb-4 text-center">How They Work Together</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          {/* Theme Color Example */}
          <div
            className="rounded-xl border-2 p-4"
            style={{
              backgroundColor: "var(--theme-background)",
              borderColor: "var(--theme-primary)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: "var(--theme-primary)" }}
              />
              <p className="text-sm font-medium text-foreground">Dashboard Card</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Uses theme colors to create weekly atmosphere
            </p>
          </div>

          {/* Activity Color Example */}
          <div
            className="rounded-xl border-2 p-4"
            style={{
              backgroundColor: "#7FABBB15",
              borderColor: "#7FABBB",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: "#7FABBB" }}
              />
              <p className="text-sm font-medium text-foreground">Schedule Block</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Uses fixed activity color for quick identification
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
