import { useMemo } from "react";
import { View, Text } from "react-native";
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

  const { markedDates, dateToPlanId } = useMemo(() => {
    const marked: Record<string, object> = {};
    const mapping: Record<string, string> = {};

    allPlans.forEach((plan: WeekPlanSummary) => {
      const year = plan.year ?? new Date().getFullYear();
      const dates = weekRangeToDates(plan.week_range, year);
      dates.forEach((dateStr) => {
        mapping[dateStr] = plan.id;
        marked[dateStr] = {
          marked: true,
          dotColor: "#387F39",
          selectedColor: "#387F39",
        };
      });
    });

    return { markedDates: marked, dateToPlanId: mapping };
  }, [allPlans]);

  const handleDayPress = (day: DateData) => {
    const planId = dateToPlanId[day.dateString];
    if (planId) {
      router.push(`/week/${planId}`);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-14 pb-3">
        <Text className="text-2xl font-bold text-foreground">Calendar</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Tap a marked date to view its weekly plan
        </Text>
      </View>

      <Calendar
        markedDates={markedDates}
        onDayPress={handleDayPress}
        theme={{
          todayTextColor: "#387F39",
          arrowColor: "#387F39",
          dotColor: "#387F39",
          selectedDayBackgroundColor: "#387F39",
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 13,
        }}
      />

      {allPlans.length === 0 && (
        <View className="items-center mt-8 px-6">
          <Text className="text-muted-foreground text-sm text-center">
            No plans yet. Generate your first weekly plan to see dates here.
          </Text>
        </View>
      )}
    </View>
  );
}
