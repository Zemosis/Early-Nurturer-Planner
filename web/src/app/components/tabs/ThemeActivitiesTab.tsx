import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, ArrowLeft, ArrowRight } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { enhanceActivity } from "../../utils/activityEnhancer";
import { DetailedActivityView } from "../DetailedActivityView";
import { DetailedActivity } from "../../types/activity";

interface ThemeActivitiesTabProps {
  week: WeekPlan;
}

const activityTimes = {
  Monday: "9:00 AM",
  Tuesday: "9:00 AM",
  Wednesday: "9:00 AM",
  Thursday: "9:00 AM",
  Friday: "9:00 AM",
};

export function ThemeActivitiesTab({ week }: ThemeActivitiesTabProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<DetailedActivity | null>(null);

  // Enhance activities with detailed structure
  const detailedActivities = week.activities.map((activity, index) =>
    enhanceActivity(activity, week, index)
  );

  // If an activity is selected, show detailed view
  if (selectedActivity) {
    return (
      <div>
        {/* Back button */}
        <button
          onClick={() => setSelectedActivity(null)}
          className="flex items-center gap-2 px-4 py-2 mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Activities
        </button>
        
        <DetailedActivityView
          activity={selectedActivity}
          themeName={week.theme}
          themeColor="var(--theme-primary)"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 mb-6 theme-transition" style={{ backgroundColor: 'var(--theme-background)' }}>
        <p className="text-sm text-center text-foreground">
          <span className="font-medium">🌟 All activities revolve around:</span> {week.theme} {week.themeEmoji}
        </p>
      </div>

      {/* Desktop: Grid, Mobile: Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {week.activities.map((activity, index) => {
          const detailedActivity = detailedActivities[index];
          
          return (
            <div
              key={activity.day}
              className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
              onClick={() => setSelectedActivity(detailedActivity)}
            >
              {/* Activity Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-foreground">{activity.day}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{activityTimes[activity.day as keyof typeof activityTimes]}</span>
                  </div>
                </div>
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-lg font-medium text-foreground flex-1 group-hover:text-primary transition-colors">{activity.title}</h4>
                  <span 
                    className="px-3 py-1 rounded-full text-xs ml-2 border theme-transition"
                    style={{
                      backgroundColor: 'var(--theme-accent-light)',
                      color: 'var(--theme-accent)',
                      borderColor: 'var(--theme-accent)'
                    }}
                  >
                    {activity.domain}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                
                {/* Click hint */}
                <div className="flex items-center gap-1.5 mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="font-medium">View full activity template</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Materials */}
              <div className="px-5 py-4 bg-muted/10">
                <p className="text-xs font-medium text-muted-foreground mb-2">Materials Needed</p>
                <ul className="space-y-1">
                  {activity.materials.map((material, index) => (
                    <li key={index} className="text-sm text-foreground flex items-start gap-2">
                      <span className="mt-0.5 theme-transition" style={{ color: 'var(--theme-primary)' }}>•</span>
                      {material}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Age Adaptations Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedDay(expandedDay === activity.day ? null : activity.day);
                }}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors border-t border-border"
              >
                <span className="text-sm font-medium text-foreground">Age Adaptations</span>
                {expandedDay === activity.day ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {expandedDay === activity.day && (
                <div className="px-5 pb-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                  {activity.adaptations.map((adaptation) => (
                    <div key={adaptation.age} className="bg-muted/10 rounded-xl p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {adaptation.age === "0-12m" && "👶 0-12 months"}
                        {adaptation.age === "12-24m" && "👣 12-24 months"}
                        {adaptation.age === "24-36m" && "🎒 24-36 months"}
                      </p>
                      <p className="text-sm text-foreground">{adaptation.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}