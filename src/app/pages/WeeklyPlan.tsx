import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { generateWeekPlan } from "../utils/mockData";
import { ChatAssistant } from "../components/ChatAssistant";
import { OverviewTab } from "../components/tabs/OverviewTab";
import { CircleTimeTab } from "../components/tabs/CircleTimeTab";
import { ThemeActivitiesTab } from "../components/tabs/ThemeActivitiesTab";
import { MaterialsTab } from "../components/tabs/MaterialsTab";
import { NewsletterTab } from "../components/tabs/NewsletterTab";
import { DocumentationTab } from "../components/tabs/DocumentationTab";
import { DailyScheduleTab } from "../components/tabs/DailyScheduleTab";
import { ThemeSelectionHeader } from "../components/ThemeSelectionHeader";
import { useTheme } from "../contexts/ThemeContext";
import { usePlanner } from "../contexts/PlannerContext";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "schedule", label: "Daily Schedule" },
  { id: "circle", label: "Circle Time" },
  { id: "activities", label: "Activities" },
  { id: "materials", label: "Materials" },
  { id: "newsletter", label: "Newsletter" },
  { id: "docs", label: "Documentation" },
];

export default function WeeklyPlan() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { setTheme, currentTheme } = useTheme();
  const { currentPlan } = usePlanner();

  // Use AI-generated plan if available, otherwise fall back to mock
  const week = currentPlan ?? generateWeekPlan(1);

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId);
  };

  // If no plan and no mock, redirect to dashboard
  if (!week) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10 theme-transition">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link
              to="/"
              className="p-2 hover:bg-secondary/20 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <div className="flex items-center gap-3 flex-1">
              <span className="text-3xl">{week.themeEmoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full theme-transition" 
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                  />
                  <h1 className="text-lg sm:text-xl text-foreground">{week.theme}</h1>
                </div>
                <p className="text-sm text-muted-foreground">
                  Week {week.weekNumber} • {week.weekRange}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors shadow-sm"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">AI Assistant</span>
            </button>
          </div>

          {/* Tabs - Mobile: Horizontal Scroll */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-1 min-w-max sm:min-w-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap theme-transition ${
                    activeTab === tab.id
                      ? "bg-theme-primary text-white"
                      : "text-muted-foreground hover:bg-theme-primary-light"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Theme Selection Header */}
        <ThemeSelectionHeader
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          weekNumber={week.weekNumber}
          weekRange={week.weekRange}
        />

        {activeTab === "overview" && <OverviewTab week={week} />}
        {activeTab === "schedule" && <DailyScheduleTab week={week} />}
        {activeTab === "circle" && <CircleTimeTab week={week} />}
        {activeTab === "activities" && <ThemeActivitiesTab week={week} />}
        {activeTab === "materials" && <MaterialsTab week={week} />}
        {activeTab === "newsletter" && <NewsletterTab week={week} />}
        {activeTab === "docs" && <DocumentationTab week={week} />}
      </main>

      <ChatAssistant
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
      />
    </div>
  );
}