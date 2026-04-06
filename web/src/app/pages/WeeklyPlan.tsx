import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, MessageCircle, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatAssistant } from "../components/ChatAssistant";
import { ChatProvider } from "../contexts/ChatContext";
import { OverviewTab } from "../components/tabs/OverviewTab";
import { CircleTimeTab } from "../components/tabs/CircleTimeTab";
import { ThemeActivitiesTab } from "../components/tabs/ThemeActivitiesTab";
import { MaterialsTab } from "../components/tabs/MaterialsTab";
import { NewsletterTab } from "../components/tabs/NewsletterTab";
import { DocumentationTab } from "../components/tabs/DocumentationTab";
import { DailyScheduleTab } from "../components/tabs/DailyScheduleTab";
import { ThemeSelectionHeader } from "../components/ThemeSelectionHeader";
import { useTheme, usePlanner, ThemeDetail, fetchPlanById, swapTheme, transformApiPlanToWeekPlan } from 'shared';
import type { ChatPlanContext } from 'shared';

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
  const { weekId } = useParams<{ weekId: string }>();
  const [activeTab, setActiveTab] = useState("overview");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { setThemeFromDetail, currentTheme } = useTheme();
  const { currentPlan, currentPlanId, setCurrentPlan, setCurrentPlanId } = usePlanner();

  // Determine if we already have the plan in context
  const hasPlanInContext = !!(currentPlanId === weekId && currentPlan);
  const [loading, setLoading] = useState(!hasPlanInContext);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Fetch plan from API if URL param doesn't match current plan in context
  useEffect(() => {
    if (!weekId) { setFetchFailed(true); return; }
    if (currentPlanId === weekId && currentPlan) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setFetchFailed(false);
    (async () => {
      try {
        const data = await fetchPlanById(weekId);
        if (cancelled) return;
        const plan = transformApiPlanToWeekPlan(data);
        setCurrentPlan(plan);
        setCurrentPlanId(weekId);
        // Apply the plan's palette to the global theme so the UI colors match
        if (plan.palette) {
          setThemeFromDetail({
            id: weekId,
            name: plan.theme,
            emoji: plan.themeEmoji,
            letter: plan.circleTime?.letter ?? '',
            shape: plan.circleTime?.shape ?? '',
            mood: '',
            atmosphere: [],
            visualDirection: '',
            palette: {
              primary: plan.palette.primary ?? '',
              secondary: plan.palette.secondary ?? '',
              accent: plan.palette.accent ?? '',
              background: plan.palette.background ?? '',
              hex: {
                primary: plan.palette.primary ?? '#6B7280',
                secondary: plan.palette.secondary ?? '#9CA3AF',
                accent: plan.palette.accent ?? '#D1D5DB',
                background: plan.palette.background ?? '#F9FAFB',
              },
            },
            circleTime: { greetingStyle: '', countingContext: '', letterExamples: [], movementPrompt: '', color: plan.circleTime?.color ?? '' },
            activities: [],
            environment: { description: '', visualElements: [], ambiance: '' },
          });
        }
      } catch (err) {
        console.error("Failed to fetch plan:", err);
        if (!cancelled) setFetchFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  // Redirect to dashboard ONLY via useEffect after a confirmed fetch failure
  useEffect(() => {
    if (fetchFailed && !loading) {
      navigate("/");
    }
  }, [fetchFailed, loading, navigate]);

  const week = currentPlan;

  // Build full plan context for the chat assistant
  const chatPlanContext = useMemo<ChatPlanContext | null>(() => {
    if (!week || !weekId) return null;
    return {
      plan_id: weekId,
      week_number: week.weekNumber,
      theme: week.theme,
      objectives: week.objectives,
      circle_time: {
        letter: week.circleTime.letter,
        color: week.circleTime.color,
        shape: week.circleTime.shape,
        counting_to: week.circleTime.countingTo,
      },
      activities: week.activities.map((a) => ({
        id: a.id,
        day: a.day,
        title: a.title,
        domain: a.domain,
        duration: a.duration,
        description: a.description,
        materials: a.materials,
        theme_connection: a.themeConnection ?? "",
        safety_notes: a.safetyNotes ?? "",
        adaptations: a.adaptations.map((ad) => ({
          age_group: ad.age,
          description: ad.content,
        })),
        reflection_prompts: a.reflectionPrompts ?? [],
      })),
    };
  }, [week, weekId]);

  const [swapLoading, setSwapLoading] = useState(false);

  const handleThemeChange = async (_theme: ThemeDetail, poolThemeUuid: string) => {
    if (!weekId) return;
    setSwapLoading(true);
    try {
      const result = await swapTheme(weekId, poolThemeUuid);
      if (result.plan_id) {
        // Clear stale context and show spinner so old plan unmounts cleanly
        setCurrentPlan(null);
        setCurrentPlanId(null);
        setLoading(true);
        navigate(`/week/${result.plan_id}`);
      }
    } catch (err) {
      console.error("Theme swap failed:", err);
    } finally {
      setSwapLoading(false);
    }
  };

  if (loading || !week) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading plan…</p>
      </div>
    );
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
          swapLoading={swapLoading}
        />

        {activeTab === "overview" && <OverviewTab week={week} />}
        {activeTab === "schedule" && <DailyScheduleTab week={week} />}
        {activeTab === "circle" && <CircleTimeTab week={week} planId={weekId} onWeekUpdate={setCurrentPlan} />}
        {activeTab === "activities" && <ThemeActivitiesTab week={week} />}
        {activeTab === "materials" && <MaterialsTab week={week} planId={weekId} />}
        {activeTab === "newsletter" && <NewsletterTab week={week} />}
        {activeTab === "docs" && <DocumentationTab week={week} />}
      </main>

      <ChatProvider planId={weekId} planContext={chatPlanContext}>
        <ChatAssistant
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
          planId={weekId}
        />
      </ChatProvider>

      {/* Theme Swap Loading Overlay */}
      <AnimatePresence>
        {swapLoading && (
          <motion.div
            key="swap-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-auto"
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4 theme-transition"
                  style={{ backgroundColor: "var(--theme-primary-light)" }}
                >
                  <Sparkles
                    className="w-8 h-8 theme-transition"
                    style={{ color: "var(--theme-primary)" }}
                  />
                </motion.div>
                <h3 className="text-xl font-medium text-foreground mb-2">
                  Switching theme…
                </h3>
                <p className="text-sm text-muted-foreground">
                  Building your new curriculum plan.
                  <br />
                  This may take up to 2 minutes.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}