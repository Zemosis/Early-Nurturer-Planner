import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { CalendarDays, Sparkles, Calendar, LayoutGrid, MessageCircle, Palette, BookOpen, FileText } from "lucide-react";
import { currentWeek } from "../utils/mockData";
import { GenerateWeekModal } from "../components/GenerateWeekModal";
import { ChatAssistant } from "../components/ChatAssistant";
import { useTheme } from "../contexts/ThemeContext";
import { getThemeByName } from "../utils/themeData";

export default function Dashboard() {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  // Apply theme from current week
  useEffect(() => {
    if (currentWeek.generated) {
      const themeDetail = getThemeByName(currentWeek.theme);
      if (themeDetail) {
        setTheme(themeDetail.id);
      }
    }
  }, [currentWeek.theme, setTheme]);

  const handleGenerate = () => {
    setShowGenerateModal(true);
  };

  const handleGenerateComplete = () => {
    setShowGenerateModal(false);
    navigate("/week/1");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl text-foreground">Early Nurturer Planner</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Sarah's Family Daycare</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/calendar"
                className="p-2 hover:bg-secondary/20 rounded-xl transition-colors"
              >
                <CalendarDays className="w-5 h-5 text-foreground" />
              </Link>
              <Link
                to="/year"
                className="p-2 hover:bg-secondary/20 rounded-xl transition-colors"
              >
                <LayoutGrid className="w-5 h-5 text-foreground" />
              </Link>
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors shadow-sm"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-medium">AI Assistant</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile: Vertical Stack | Tablet/Desktop: 4-Square Grid */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 py-6 lg:py-8">
        {/* Mobile Layout: Vertical Stack */}
        <div className="lg:hidden space-y-6">
          {/* Generate Week Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-medium text-foreground">Generate Week</h2>
                <p className="text-sm text-muted-foreground">Create new curriculum plan</p>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Sparkles className="w-5 h-5" />
              Generate Week
            </button>
          </div>

          {/* Current Week/Theme Card */}
          {currentWeek.generated ? (
            <div 
              className="rounded-2xl shadow-sm border-2 border-theme-primary p-6 theme-transition" 
              style={{ backgroundColor: 'var(--theme-background)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{currentWeek.themeEmoji}</span>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">This Week's Theme</p>
                  <h3 className="text-xl text-foreground">{currentWeek.theme}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Week {currentWeek.weekNumber} • {currentWeek.weekRange}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {currentWeek.domains.slice(0, 3).map((domain) => (
                  <span
                    key={domain}
                    className="px-3 py-1.5 rounded-full text-xs theme-transition border"
                    style={{ 
                      backgroundColor: 'var(--theme-secondary-light)',
                      color: 'var(--theme-secondary)',
                      borderColor: 'var(--theme-secondary)'
                    }}
                  >
                    {domain}
                  </span>
                ))}
              </div>

              <Link
                to="/week/1"
                className="inline-flex items-center font-medium theme-transition hover:opacity-80"
                style={{ color: 'var(--theme-primary)' }}
              >
                View Full Plan →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-accent/30 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Week</p>
                  <p className="font-medium text-foreground">Week {currentWeek.weekNumber} • {currentWeek.weekRange}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                No curriculum generated yet. Click "Generate Week" to create your first plan.
              </p>
            </div>
          )}

          {/* Quick Links */}
          <div className="space-y-3">
            <Link
              to="/calendar"
              className="block bg-white rounded-2xl shadow-sm border border-border p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-muted/40 rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">Calendar View</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Browse all weeks and themes
              </p>
            </Link>

            <Link
              to="/year"
              className="block bg-white rounded-2xl shadow-sm border border-border p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-muted/40 rounded-xl flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">Year Overview</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                See your full curriculum plan
              </p>
            </Link>
          </div>
        </div>

        {/* Desktop/Tablet Layout: 4-Square Grid (2x2) */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6 xl:gap-8">
          {/* Top Left: Generate Week */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-3xl shadow-sm border-2 border-primary/20 p-8 flex flex-col justify-between min-h-[400px] hover:shadow-lg transition-all">
            <div>
              <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-3">Generate Week</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Create a comprehensive weekly curriculum plan with themes, activities, and materials tailored for mixed-age groups (0-3 years).
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>AI-generated themes & activities</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Age-specific adaptations (0-12m, 12-24m, 24-36m)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Print-ready materials & newsletters</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-5 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all shadow-md hover:shadow-xl text-lg"
            >
              <Sparkles className="w-6 h-6" />
              Generate New Week
            </button>
          </div>

          {/* Top Right: Current Week/Theme */}
          {currentWeek.generated ? (
            <div 
              className="rounded-3xl shadow-sm border-2 p-8 flex flex-col justify-between min-h-[400px] theme-transition hover:shadow-lg transition-all" 
              style={{ 
                backgroundColor: 'var(--theme-background)',
                borderColor: 'var(--theme-primary)'
              }}
            >
              <div>
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-6xl leading-none">{currentWeek.themeEmoji}</span>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">This Week's Theme</p>
                    <h2 className="text-2xl font-semibold text-foreground mb-1">{currentWeek.theme}</h2>
                    <p className="text-sm text-muted-foreground">Week {currentWeek.weekNumber} • {currentWeek.weekRange}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Developmental Domains</p>
                  <div className="flex flex-wrap gap-2">
                    {currentWeek.domains.map((domain) => (
                      <span
                        key={domain}
                        className="px-3 py-2 rounded-xl text-sm font-medium theme-transition border"
                        style={{ 
                          backgroundColor: 'var(--theme-secondary-light)',
                          color: 'var(--theme-secondary)',
                          borderColor: 'var(--theme-secondary)'
                        }}
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 mb-6">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Quick Stats</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{currentWeek.activities.length}</p>
                      <p className="text-xs text-muted-foreground">Activities</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{currentWeek.domains.length}</p>
                      <p className="text-xs text-muted-foreground">Domains</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">5</p>
                      <p className="text-xs text-muted-foreground">Days</p>
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to="/week/1"
                className="w-full py-5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-xl text-lg theme-transition border-2"
                style={{ 
                  backgroundColor: 'var(--theme-primary)',
                  color: 'white',
                  borderColor: 'var(--theme-primary)'
                }}
              >
                View Full Week Plan →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border-2 border-border p-8 flex flex-col justify-between min-h-[400px] hover:shadow-lg transition-all">
              <div>
                <div className="w-16 h-16 bg-accent/30 rounded-2xl flex items-center justify-center mb-6">
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-3">Current Week</h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Week {currentWeek.weekNumber} • {currentWeek.weekRange}
                </p>
                <div className="bg-muted/30 border border-border rounded-xl p-6 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No curriculum generated yet. Click "Generate New Week" to create your first comprehensive weekly plan with themes, activities, and materials.
                  </p>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                className="w-full bg-muted/50 hover:bg-muted/70 text-foreground py-5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all border border-border"
              >
                <Sparkles className="w-5 h-5" />
                Get Started
              </button>
            </div>
          )}

          {/* Bottom Left: Calendar View */}
          <Link
            to="/calendar"
            className="bg-white rounded-3xl shadow-sm border-2 border-border p-8 flex flex-col justify-between min-h-[400px] hover:shadow-lg hover:border-primary/30 transition-all group"
          >
            <div>
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-secondary/20 transition-colors">
                <CalendarDays className="w-8 h-8 text-secondary group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-3">Calendar View</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Browse all your weekly plans in an organized calendar format. View themes, activities, and schedules at a glance.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                  <span>Monthly calendar view</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                  <span>Quick theme navigation</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                  <span>Week-by-week organization</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-secondary font-medium group-hover:gap-3 transition-all">
              <span>Open Calendar</span>
              <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* Bottom Right: Year Overview */}
          <Link
            to="/year"
            className="bg-white rounded-3xl shadow-sm border-2 border-border p-8 flex flex-col justify-between min-h-[400px] hover:shadow-lg hover:border-primary/30 transition-all group"
          >
            <div>
              <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-accent/30 transition-colors">
                <LayoutGrid className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-3">Year Overview</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                See your complete curriculum plan across the entire year. Track themes, domains, and progression through all 52 weeks.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>52-week overview</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Theme distribution</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Long-term planning</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-primary font-medium group-hover:gap-3 transition-all">
              <span>View Year Plan</span>
              <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>
      </main>

      {/* Modals & Assistants */}
      {showGenerateModal && <GenerateWeekModal onComplete={handleGenerateComplete} />}
      <ChatAssistant isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} />
    </div>
  );
}