import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import PagerView from "react-native-pager-view";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  fetchPlanById,
  transformApiPlanToWeekPlan,
  getApiBase,
  DEFAULT_USER_ID,
  type WeekPlan,
} from "shared";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardContent } from "../../components/ui/Card";
import ChatAssistantBottomSheet, { type ChatAssistantRef } from "../../components/ChatAssistantBottomSheet";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function WeekPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const chatSheetRef = useRef<ChatAssistantRef>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPlanById(id);
        if (!cancelled) {
          const transformed = transformApiPlanToWeekPlan(data);
          setPlan(transformed);
        }
      } catch {
        if (!cancelled) setError("Failed to load plan details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const url = `${getApiBase()}/api/planner/${DEFAULT_USER_ID}/plan/${id}/pdf`;
      const fileUri = `${FileSystem.documentDirectory}plan-${id}.pdf`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save or share your weekly plan",
        });
      } else {
        Alert.alert("Downloaded", `PDF saved to ${uri}`);
      }
    } catch {
      Alert.alert("Error", "Failed to download PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#387F39" />
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-destructive text-base text-center">
          {error || "Plan not found."}
        </Text>
        <Button variant="outline" onPress={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </View>
    );
  }

  // Group activities by day
  const activitiesByDay = DAYS.map((day) =>
    plan.activities.filter((a) => a.day === day)
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-14 pb-3 border-b border-border">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Button
            size="sm"
            loading={downloading}
            onPress={handleDownloadPDF}
          >
            Download PDF
          </Button>
        </View>
        <Text className="text-xl font-bold text-foreground mt-2">
          {plan.themeEmoji} {plan.theme}
        </Text>
        <Text className="text-sm text-muted-foreground">
          Week {plan.weekNumber} &middot; {plan.weekRange}
        </Text>
        {plan.domains.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-2">
            {plan.domains.map((d) => (
              <Badge key={d} variant="secondary">{d}</Badge>
            ))}
          </View>
        )}
      </View>

      {/* Day tabs */}
      <View className="flex-row border-b border-border">
        {DAYS.map((day, i) => (
          <Pressable
            key={day}
            onPress={() => {
              setActiveDay(i);
              pagerRef.current?.setPage(i);
            }}
            className={`flex-1 items-center py-3 ${
              activeDay === i ? "border-b-2 border-primary" : ""
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                activeDay === i ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {day.slice(0, 3)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Day pages */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => setActiveDay(e.nativeEvent.position)}
      >
        {DAYS.map((day, dayIndex) => (
          <ScrollView
            key={day}
            contentContainerClassName="p-4 pb-8"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-lg font-semibold text-foreground mb-3">
              {day}
            </Text>

            {activitiesByDay[dayIndex].length === 0 ? (
              <Text className="text-muted-foreground text-sm">
                No activities scheduled for this day.
              </Text>
            ) : (
              activitiesByDay[dayIndex].map((activity, i) => (
                <Card key={`${day}-${i}`} className="mb-3">
                  <CardContent>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-base font-semibold text-foreground flex-shrink">
                        {activity.title}
                      </Text>
                      <Badge variant="outline">{activity.domain}</Badge>
                    </View>

                    <Text className="text-sm text-muted-foreground mt-2">
                      {activity.description}
                    </Text>

                    {activity.materials.length > 0 && (
                      <View className="mt-3">
                        <Text className="text-xs font-medium text-foreground mb-1">
                          Materials
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {activity.materials.join(", ")}
                        </Text>
                      </View>
                    )}

                    {activity.adaptations.length > 0 && (
                      <View className="mt-3">
                        <Text className="text-xs font-medium text-foreground mb-1">
                          Adaptations
                        </Text>
                        {activity.adaptations.map((adapt, j) => (
                          <Text
                            key={j}
                            className="text-xs text-muted-foreground mb-0.5"
                          >
                            {adapt.age}: {adapt.content}
                          </Text>
                        ))}
                      </View>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </ScrollView>
        ))}
      </PagerView>

      {/* Floating chat button */}
      <Pressable
        onPress={() => chatSheetRef.current?.open()}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{ elevation: 5 }}
      >
        <Text className="text-primary-foreground text-xl">💬</Text>
      </Pressable>

      <ChatAssistantBottomSheet ref={chatSheetRef} />
    </View>
  );
}
