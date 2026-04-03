import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Calendar, type DateData } from "react-native-calendars";
import { usePlanner, type WeekPlanSummary } from "shared";

/** Parse "3/2 - 3/6" + year → array of YYYY-MM-DD strings for Mon-Fri. */
function weekRangeToDates(weekRange: string, year: number): string[] {
  const match = weekRange.match(/^(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})$/);
  if (!match) return [];

  const startMonth = parseInt(match[1], 10);
  const startDay = parseInt(match[2], 10);
  const endMonth = parseInt(match[3], 10);
  const endDay = parseInt(match[4], 10);

  const dates: string[] = [];
  const current = new Date(year, startMonth - 1, startDay);
  const end = new Date(year, endMonth - 1, endDay);

  while (current <= end) {
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${current.getFullYear()}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default function CalendarScreen() {
  const { allPlans } = usePlanner();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<WeekPlanSummary | null>(null);

  const { markedDates, dateToPlanId, dateToPlan } = useMemo(() => {
    const marked: Record<string, object> = {};
    const idMapping: Record<string, string> = {};
    const planMapping: Record<string, WeekPlanSummary> = {};

    allPlans.forEach((plan: WeekPlanSummary) => {
      const planColor = plan.palette?.primary || "#387F39";
      const year = plan.year ?? new Date().getFullYear();
      const dates = weekRangeToDates(plan.week_range, year);
      dates.forEach((dateStr, idx) => {
        idMapping[dateStr] = plan.id;
        planMapping[dateStr] = plan;
        const isStart = idx === 0;
        const isEnd = idx === dates.length - 1;
        marked[dateStr] = {
          color: planColor + "35",
          textColor: "#1a1a1a",
          startingDay: isStart,
          endingDay: isEnd,
          ...(isStart || isEnd
            ? { color: planColor, textColor: "#fff" }
            : {}),
        };
      });
    });

    return { markedDates: marked, dateToPlanId: idMapping, dateToPlan: planMapping };
  }, [allPlans]);

  const handleDayPress = (day: DateData) => {
    const plan = dateToPlan[day.dateString];
    if (plan) {
      setSelectedPlan(plan);
    } else {
      setSelectedPlan(null);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-8">
      <View className="px-4 pt-2 pb-2">
        <Text className="text-xs text-muted-foreground">
          Tap a highlighted week to see details
        </Text>
      </View>

      <Calendar
        markingType="period"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        theme={{
          todayTextColor: "#387F39",
          arrowColor: "#6B7280",
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 13,
        }}
      />

      {/* Selected week card */}
      {selectedPlan && (() => {
        const pc = selectedPlan.palette?.primary || "#387F39";
        return (
          <View className="px-4 mt-4">
            <Pressable onPress={() => router.push(`/week/${selectedPlan.id}`)}>
              <View
                className="rounded-xl overflow-hidden border border-border bg-card"
                style={{ borderLeftWidth: 4, borderLeftColor: pc }}
              >
                <View className="p-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-semibold text-foreground">
                      {`${selectedPlan.theme_emoji} ${selectedPlan.theme}`}
                    </Text>
                    <Text style={{ color: pc, fontSize: 12, fontWeight: "500" }}>{"View →"}</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground mb-2">
                    {`Week ${selectedPlan.global_week_number} \u2022 ${selectedPlan.week_range}`}
                  </Text>
                  {selectedPlan.domains && selectedPlan.domains.length > 0 && (
                    <View className="flex-row flex-wrap gap-1.5">
                      {selectedPlan.domains.map((domain) => (
                        <View key={domain} className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: pc + "15" }}>
                          <Text style={{ color: pc, fontSize: 11, fontWeight: "500" }}>{domain}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          </View>
        );
      })()}

      {allPlans.length === 0 && (
        <View className="items-center mt-8 px-6">
          <Text className="text-muted-foreground text-sm text-center">
            No plans yet. Generate your first weekly plan to see dates here.
          </Text>
        </View>
      )}

      {/* Legend */}
      {allPlans.length > 0 && !selectedPlan && (
        <View className="px-4 mt-6">
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1.5">
              <View className="w-4 h-4 rounded" style={{ backgroundColor: "#6B7280" }} />
              <Text className="text-xs text-muted-foreground">Week start/end</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-4 h-4 rounded" style={{ backgroundColor: "#6B728020" }} />
              <Text className="text-xs text-muted-foreground">Plan dates</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
