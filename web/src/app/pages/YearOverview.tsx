import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { yearData } from "../utils/mockData";
import { ChatAssistant } from "../components/ChatAssistant";
import { getThemeByName } from "../utils/themeData";

export default function YearOverview() {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

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
              <h1 className="text-xl sm:text-2xl text-foreground">Year Overview</h1>
              <p className="text-sm text-muted-foreground mt-0.5">2026 Curriculum Plan</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Mobile: 2 columns, Desktop: 4 columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {yearData.map((month, index) => {
            const primaryDomain = month.weeks[0]?.domains[0] || "Mixed";
            const domainColors: Record<string, string> = {
              "Fine Motor": "bg-chart-2/20 border-chart-2/40",
              Language: "bg-chart-3/20 border-chart-3/40",
              Sensory: "bg-chart-4/20 border-chart-4/40",
              "Gross Motor": "bg-chart-1/20 border-chart-1/40",
              Cognitive: "bg-secondary/20 border-secondary/40",
              Mixed: "bg-muted/20 border-muted/40",
            };

            return (
              <div key={month.month}>
                <button
                  onClick={() =>
                    setExpandedMonth(expandedMonth === month.month ? null : month.month)
                  }
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                    domainColors[primaryDomain] || domainColors.Mixed
                  } hover:shadow-md`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-foreground">{month.month}</h3>
                    {expandedMonth === month.month ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground mt-0.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{primaryDomain} Focus</p>
                  <div className="flex items-center gap-1">
                    {month.weeks.slice(0, 4).map((week) => (
                      <div
                        key={week.id}
                        className={`w-2 h-2 rounded-full ${
                          week.generated ? "bg-primary" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                </button>

                {/* Expanded Weekly Breakdown */}
                {expandedMonth === month.month && (
                  <div className="mt-3 space-y-2 col-span-2 md:col-span-3 lg:col-span-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {month.weeks.map((week) => {
                        const themeDetail = getThemeByName(week.theme);
                        const themeColor = themeDetail?.palette.hex.primary || '#387F39';
                        const themeSecondary = themeDetail?.palette.hex.secondary || '#8B6F47';
                        
                        return (
                          <Link
                            key={week.id}
                            to={`/week/${week.weekNumber}`}
                            className="bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-all"
                            style={{ borderTopColor: themeColor }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">{week.themeEmoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div 
                                    className="w-1.5 h-1.5 rounded-full" 
                                    style={{ backgroundColor: themeColor }}
                                  />
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {week.theme}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Week {week.weekNumber}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {week.domains.slice(0, 2).map((domain) => (
                                <span
                                  key={domain}
                                  className="px-2 py-0.5 rounded text-xs border"
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
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-5 text-center">
            <p className="text-2xl font-medium text-primary mb-1">52</p>
            <p className="text-sm text-muted-foreground">Total Weeks</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-border p-5 text-center">
            <p className="text-2xl font-medium text-primary mb-1">48</p>
            <p className="text-sm text-muted-foreground">Themes Planned</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-border p-5 text-center">
            <p className="text-2xl font-medium text-primary mb-1">5</p>
            <p className="text-sm text-muted-foreground">Core Domains</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-border p-5 text-center">
            <p className="text-2xl font-medium text-primary mb-1">3</p>
            <p className="text-sm text-muted-foreground">Age Groups</p>
          </div>
        </div>
      </main>

      <ChatAssistant />
    </div>
  );
}
