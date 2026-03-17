import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { ChatAssistant } from "../components/ChatAssistant";
import { usePlanner } from "../contexts/PlannerContext";
import { fetchAllPlans, WeekPlanSummary } from "../utils/api";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarView() {
  const { allPlans, setAllPlans } = usePlanner();
  const [loading, setLoading] = useState(allPlans.length === 0);

  useEffect(() => {
    if (allPlans.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const plans = await fetchAllPlans();
        if (!cancelled) {
          setAllPlans(plans);
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group plans by year-month
  const grouped = new Map<string, WeekPlanSummary[]>();
  for (const plan of allPlans) {
    const key = `${plan.year}-${String(plan.month).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(plan);
  }

  // Sort keys descending (most recent first)
  const sortedKeys = [...grouped.keys()].sort().reverse();

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
              <p className="text-sm text-muted-foreground mt-0.5">All generated plans</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading plans…</p>
          </div>
        ) : allPlans.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground mb-2">No plans yet</p>
            <p className="text-sm text-muted-foreground">
              Generate your first week plan from the{" "}
              <Link to="/" className="text-primary hover:underline">Dashboard</Link>.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedKeys.map((key) => {
              const plans = grouped.get(key)!;
              const firstPlan = plans[0];
              const monthLabel = `${MONTH_NAMES[firstPlan.month]} ${firstPlan.year}`;

              return (
                <div key={key}>
                  <h2 className="text-lg font-medium text-foreground mb-4">{monthLabel}</h2>
                  <div className="space-y-4">
                    {plans
                      .sort((a, b) => a.week_of_month - b.week_of_month)
                      .map((plan) => {
                        const primaryColor = plan.palette?.primary || "#387F39";
                        const secondaryColor = plan.palette?.secondary || "#8B6F47";

                        return (
                          <Link
                            key={plan.id}
                            to={`/week/${plan.id}`}
                            className="block bg-white rounded-2xl shadow-sm border-2 p-5 hover:shadow-md transition-all"
                            style={{ borderTopColor: primaryColor }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-3xl">{plan.theme_emoji}</span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: primaryColor }}
                                    />
                                    <h3 className="font-medium text-foreground">{plan.theme}</h3>
                                    <CheckCircle2 className="w-4 h-4" style={{ color: primaryColor }} />
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Week {plan.week_of_month} • {plan.week_range}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg">
                                #{plan.global_week_number}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {(plan.domains || []).map((domain) => (
                                <span
                                  key={domain}
                                  className="px-3 py-1 rounded-full text-sm border"
                                  style={{
                                    backgroundColor: secondaryColor + "20",
                                    color: secondaryColor,
                                    borderColor: secondaryColor + "40",
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
              );
            })}
          </div>
        )}
      </main>

      <ChatAssistant />
    </div>
  );
}
