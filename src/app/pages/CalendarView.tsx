import { Link } from "react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { yearData } from "../utils/mockData";
import { ChatAssistant } from "../components/ChatAssistant";
import { getThemeByName } from "../utils/themeData";

export default function CalendarView() {
  const currentMonth = yearData[1]; // February

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 hover:bg-secondary/20 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl text-foreground">Calendar View</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{currentMonth.month} 2026</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-4">
          {currentMonth.weeks.map((week) => {
            const themeDetail = getThemeByName(week.theme);
            const themeColor = themeDetail?.palette.hex.primary || '#387F39';
            const themeBgColor = themeDetail?.palette.hex.background || '#F5F1E8';
            const themeSecondary = themeDetail?.palette.hex.secondary || '#8B6F47';
            
            return (
              <Link
                key={week.id}
                to={`/week/${week.weekNumber}`}
                className="block bg-white rounded-2xl shadow-sm border-2 p-5 hover:shadow-md transition-all theme-transition"
                style={{ borderTopColor: themeColor }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{week.themeEmoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: themeColor }}
                        />
                        <h3 className="font-medium text-foreground">{week.theme}</h3>
                        {week.generated && (
                          <CheckCircle2 className="w-4 h-4" style={{ color: themeColor }} />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Week {week.weekNumber} • {week.weekRange}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {week.domains.map((domain) => (
                    <span
                      key={domain}
                      className="px-3 py-1 rounded-full text-sm border"
                      style={{
                        backgroundColor: themeSecondary + '20',
                        color: themeSecondary,
                        borderColor: themeSecondary + '40'
                      }}
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Other Months Preview */}
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Other Months</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {yearData.slice(0, 8).map((month, index) => (
              <button
                key={month.month}
                className={`p-4 rounded-xl border border-border text-left transition-all ${
                  index === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-white hover:bg-muted/20"
                }`}
              >
                <p className="text-sm font-medium">{month.month}</p>
                <p className="text-xs mt-1 opacity-75">
                  {month.weeks.filter((w) => w.generated).length} weeks planned
                </p>
              </button>
            ))}
          </div>
        </div>
      </main>

      <ChatAssistant />
    </div>
  );
}
