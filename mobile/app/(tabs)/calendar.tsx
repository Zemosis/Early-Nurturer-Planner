import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Calendar, type DateData } from "react-native-calendars";
import { usePlanner, type WeekPlanSummary } from "shared";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

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
      const year = plan.year ?? new Date().getFullYear();
      const dates = weekRangeToDates(plan.week_range, year);
      dates.forEach((dateStr, idx) => {
        idMapping[dateStr] = plan.id;
        planMapping[dateStr] = plan;
        const isStart = idx === 0;
        const isEnd = idx === dates.length - 1;
        marked[dateStr] = {
          color: "#387F3920",
          textColor: "#1a1a1a",
          startingDay: isStart,
          endingDay: isEnd,
          ...(isStart || isEnd
            ? { customContainerStyle: { backgroundColor: "#387F39" }, textColor: "#fff" }
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
      <View className="px-4 pt-14 pb-3">
        <Text className="text-2xl font-bold text-foreground">Calendar</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Tap a highlighted week to see details
        </Text>
      </View>

      <Calendar
        markingType="period"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        theme={{
          todayTextColor: "#387F39",
          arrowColor: "#387F39",
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 13,
        }}
      />

      {/* Selected week card */}
      {selectedPlan && (
        <View className="px-4 mt-4">
          <Pressable onPress={() => router.push(`/week/${selectedPlan.id}`)}>
            <Card>
              <CardContent>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-lg font-semibold text-foreground">
                    {`${selectedPlan.theme_emoji} ${selectedPlan.theme}`}
                  </Text>
                  <Text className="text-xs text-primary font-medium">View →</Text>
                </View>
                <Text className="text-sm text-muted-foreground mb-2">
                  {`Week ${selectedPlan.global_week_number} \u2022 ${selectedPlan.week_range}`}
                </Text>
                {selectedPlan.domains && selectedPlan.domains.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5">
                    {selectedPlan.domains.map((domain) => (
                      <Badge key={domain} variant="secondary">{domain}</Badge>
                    ))}
                  </View>
                )}
              </CardContent>
            </Card>
          </Pressable>
        </View>
      )}

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
              <View className="w-4 h-4 rounded" style={{ backgroundColor: "#387F39" }} />
              <Text className="text-xs text-muted-foreground">Week start/end</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-4 h-4 rounded" style={{ backgroundColor: "#387F3920" }} />
              <Text className="text-xs text-muted-foreground">Plan dates</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
