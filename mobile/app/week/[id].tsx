import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Image,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import PagerView from "react-native-pager-view";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchPlanById,
  transformApiPlanToWeekPlan,
  getApiBase,
  DEFAULT_USER_ID,
  type WeekPlan,
  useSchedule,
  type ScheduleBlock,
  formatTime12Hour,
  calculateDuration,
} from "shared";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import ChatAssistantBottomSheet, { type ChatAssistantRef } from "../../components/ChatAssistantBottomSheet";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SECTION_TABS = [
  { key: "schedule", label: "Schedule" },
  { key: "activities", label: "Activities" },
  { key: "circle", label: "Circle Time" },
  { key: "objectives", label: "Objectives" },
  { key: "materials", label: "Materials" },
  { key: "newsletter", label: "Newsletter" },
] as const;

type SectionKey = (typeof SECTION_TABS)[number]["key"];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  circle: { bg: "#7A9B7615", border: "#7A9B76", dot: "#7A9B76", label: "Circle Time" },
  yoga: { bg: "#B4A7D615", border: "#9B8FCC", dot: "#9B8FCC", label: "Yoga Time" },
  theme: { bg: "#F4B74015", border: "#F4B740", dot: "#F4B740", label: "Theme Activity" },
  "gross-motor": { bg: "#D4845B15", border: "#D4845B", dot: "#D4845B", label: "Gross Motor" },
  sensory: { bg: "#7FABBB15", border: "#7FABBB", dot: "#7FABBB", label: "Sensory Activity" },
  "free-play": { bg: "#E8A5B815", border: "#E8A5B8", dot: "#E8A5B8", label: "Free Play" },
  transition: { bg: "#C8B6A615", border: "#C8B6A6", dot: "#C8B6A6", label: "Transition" },
  routine: { bg: "#E8E8E8", border: "#B8B8B8", dot: "#B8B8B8", label: "Daily Routine" },
};

function getDefaultSchedule(week: WeekPlan): ScheduleBlock[] {
  return [
    { id: "block-arrival", startTime: "08:00", endTime: "08:30", title: "Arrival & Free Play", description: "Greet children, health check, self-directed exploration", category: "free-play" },
    { id: "block-snack-1", startTime: "08:30", endTime: "08:45", title: "Morning Snack", description: "Healthy snack and social time", category: "routine" },
    { id: "block-circle", startTime: "08:45", endTime: "09:00", title: "Circle Time", description: `${week.circleTime.greetingSong.title} • Letter ${week.circleTime.letter} • Color ${week.circleTime.color}`, category: "circle" },
    { id: "block-yoga", startTime: "09:00", endTime: "09:15", title: "\uD83E\uDDD8 Yoga Time", description: "Mindful movement and breathing • Linked to Circle Time yoga poses", category: "yoga" },
    { id: "block-theme", startTime: "09:15", endTime: "09:45", title: "Theme Activity", description: week.activities[0]?.title || "Themed learning activity", category: "theme" },
    { id: "block-outdoor", startTime: "09:45", endTime: "10:30", title: "Outdoor Play", description: "Gross motor development, nature exploration", category: "gross-motor" },
    { id: "block-transition-1", startTime: "10:30", endTime: "10:45", title: "Diaper/Bathroom & Wash", description: "Individual care routines", category: "transition" },
    { id: "block-lunch", startTime: "10:45", endTime: "11:15", title: "Lunch", description: "Family-style dining, social skills", category: "routine" },
    { id: "block-nap", startTime: "11:15", endTime: "12:45", title: "Quiet Time / Nap", description: "Rest, books, or calm activities by age", category: "routine" },
    { id: "block-transition-2", startTime: "12:45", endTime: "13:00", title: "Wake & Transition", description: "Gentle wake-up, diaper changes", category: "transition" },
    { id: "block-snack-2", startTime: "13:00", endTime: "13:15", title: "Afternoon Snack", description: "Light snack and hydration", category: "routine" },
    { id: "block-sensory", startTime: "13:15", endTime: "13:45", title: "Sensory Exploration", description: week.activities[2]?.title || "Sensory-rich themed activity", category: "sensory" },
    { id: "block-freeplay-2", startTime: "13:45", endTime: "14:45", title: "Free Play & Centers", description: "Self-directed exploration with theme materials", category: "free-play" },
    { id: "block-closing", startTime: "14:45", endTime: "14:55", title: "Closing Circle", description: week.circleTime.goodbyeSong.title, category: "circle" },
    { id: "block-departure", startTime: "14:55", endTime: "15:00", title: "Departure & Family Updates", description: "Share daily highlights with families", category: "transition" },
  ];
}

function extractAllMaterials(plan: WeekPlan): string[] {
  const allMaterials = plan.activities.flatMap((a) => a.materials);
  return [...new Set(allMaterials)].sort();
}

export default function WeekPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionKey>("schedule");
  const [newsletterStyle, setNewsletterStyle] = useState<"professional" | "warm">("professional");
  const [downloading, setDownloading] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const chatSheetRef = useRef<ChatAssistantRef>(null);
  const { getSchedule, initializeSchedule } = useSchedule();

  useFocusEffect(
    useCallback(() => {
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
    }, [id])
  );

  // Initialize the timed schedule when plan loads
  useEffect(() => {
    if (!plan) return;
    const weekId = `week-${plan.weekNumber}`;
    const existing = getSchedule(weekId);
    if (existing.length === 0) {
      initializeSchedule(weekId, getDefaultSchedule(plan));
    }
  }, [plan]);

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

  const masterMaterials = useMemo(
    () => (plan ? extractAllMaterials(plan) : []),
    [plan]
  );

  const schedule = plan ? getSchedule(`week-${plan.weekNumber}`) : [];

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

      {/* Section tabs — text-only, consistent sizing like web app */}
      <View className="border-b border-border">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 4, paddingVertical: 8 }}
        >
          {SECTION_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveSection(tab.key)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
              className={
                activeSection === tab.key
                  ? "bg-primary"
                  : "bg-transparent"
              }
            >
              <Text
                className={`text-sm font-medium ${
                  activeSection === tab.key
                    ? "text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Timed Daily Schedule Section ── */}
      {activeSection === "schedule" && (
        <ScrollView
          contentContainerClassName="p-4 pb-8"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-lg font-semibold text-foreground mb-1">
            Daily Flow
          </Text>
          <Text className="text-xs text-muted-foreground mb-4">
            {schedule.length} activities • Read-only on mobile
          </Text>

          {schedule.map((block) => {
            const colors = CATEGORY_COLORS[block.category] || CATEGORY_COLORS.routine;
            const duration = calculateDuration(block.startTime, block.endTime);
            return (
              <View
                key={block.id}
                className="rounded-xl overflow-hidden mb-3"
                style={{ borderLeftWidth: 4, borderLeftColor: colors.border, backgroundColor: colors.bg }}
              >
                <View className="p-4">
                  <View className="flex-row items-start justify-between mb-1">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                        <Text className="text-xs text-muted-foreground">
                          {formatTime12Hour(block.startTime)} – {formatTime12Hour(block.endTime)}
                        </Text>
                      </View>
                      <Text className="text-sm font-medium text-foreground">{block.title}</Text>
                    </View>
                    <View
                      className="rounded-md px-2 py-0.5"
                      style={{ backgroundColor: "white" }}
                    >
                      <Text style={{ color: colors.border, fontSize: 11, fontWeight: "600" }}>
                        {`${duration}m`}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-muted-foreground mt-1">{block.description}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Activities Section (Mon-Fri PagerView) ── */}
      {activeSection === "activities" && (
        <>
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
                <Text className="text-lg font-semibold text-foreground mb-4">
                  {day}
                </Text>

                {activitiesByDay[dayIndex].length === 0 ? (
                  <Text className="text-muted-foreground text-sm">
                    No activities scheduled for this day.
                  </Text>
                ) : (
                  activitiesByDay[dayIndex].map((activity, i) => (
                    <Card key={`${day}-${i}`} className="mb-4">
                      <CardContent>
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-base font-semibold text-foreground flex-1 mr-2">
                            {activity.title}
                          </Text>
                          <Badge variant="outline">{activity.domain}</Badge>
                        </View>

                        <Text className="text-sm text-muted-foreground leading-5 mt-1">
                          {activity.description}
                        </Text>

                        {activity.materials.length > 0 && (
                          <View className="mt-4">
                            <Text className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">
                              Materials
                            </Text>
                            <Text className="text-xs text-muted-foreground leading-4">
                              {activity.materials.join(", ")}
                            </Text>
                          </View>
                        )}

                        {activity.adaptations.length > 0 && (
                          <View className="mt-4">
                            <Text className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">
                              Adaptations
                            </Text>
                            {activity.adaptations.map((adapt, j) => (
                              <Text
                                key={j}
                                className="text-xs text-muted-foreground mb-1 leading-4"
                              >
                                <Text className="font-medium text-foreground">{adapt.age}:</Text>{" "}
                                {adapt.content}
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
        </>
      )}

      {/* ── Objectives Section ── */}
      {activeSection === "objectives" && (
        <ScrollView
          contentContainerClassName="p-4 pb-8"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-lg font-semibold text-foreground mb-4">
            Learning Objectives
          </Text>
          {plan.objectives.length === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No objectives available for this plan.
            </Text>
          ) : (
            plan.objectives.map((obj, i) => (
              <Card key={i} className="mb-3">
                <CardContent>
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="flag" size={16} color="#387F39" style={{ marginRight: 8 }} />
                    <Badge variant="secondary">{obj.domain}</Badge>
                  </View>
                  <Text className="text-sm text-foreground">{obj.goal}</Text>
                </CardContent>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Circle Time Section ── */}
      {activeSection === "circle" && (
        <ScrollView
          contentContainerClassName="p-4 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {/* Basics */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>
                <View className="flex-row items-center">
                  <Ionicons name="book" size={16} color="#387F39" style={{ marginRight: 8 }} />
                  <Text className="text-base font-semibold text-foreground">This Week's Focus</Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex-row justify-around">
                <View className="items-center px-2">
                  <Text className="text-3xl font-bold text-primary">{plan.circleTime.letter}</Text>
                  <Text className="text-xs text-muted-foreground mt-1">Letter</Text>
                  {plan.circleTime.letterWord && (
                    <Text className="text-xs text-muted-foreground">({plan.circleTime.letterWord})</Text>
                  )}
                </View>
                <View className="items-center px-2">
                  <Text className="text-3xl font-bold text-primary">{plan.circleTime.shape}</Text>
                  <Text className="text-xs text-muted-foreground mt-1">Shape</Text>
                </View>
                <View className="items-center px-2">
                  <View
                    className="w-10 h-10 rounded-full"
                    style={{ backgroundColor: plan.circleTime.color.toLowerCase() }}
                  />
                  <Text className="text-xs text-muted-foreground mt-1">{plan.circleTime.color}</Text>
                  {plan.circleTime.colorObject && (
                    <Text className="text-xs text-muted-foreground">({plan.circleTime.colorObject})</Text>
                  )}
                </View>
                <View className="items-center px-2">
                  <Text className="text-3xl font-bold text-primary">{plan.circleTime.countingTo}</Text>
                  <Text className="text-xs text-muted-foreground mt-1">Count to</Text>
                  {plan.circleTime.countingObject && (
                    <Text className="text-xs text-muted-foreground">({plan.circleTime.countingObject})</Text>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Greeting Song */}
          <Card className="mb-4">
            <CardContent>
              <View className="flex-row items-center mb-3">
                <Ionicons name="musical-notes" size={16} color="#387F39" style={{ marginRight: 8 }} />
                <Text className="text-sm font-semibold text-foreground">Greeting Song</Text>
              </View>
              <Text className="text-base font-medium text-primary mb-2">{plan.circleTime.greetingSong.title}</Text>
              {plan.circleTime.greetingSong.videoUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(plan.circleTime.greetingSong.videoUrl)}
                  className="mb-3"
                >
                  <View className="bg-muted rounded-lg p-3 flex-row items-center">
                    <Ionicons name="play-circle" size={24} color="#387F39" style={{ marginRight: 10 }} />
                    <Text className="text-xs text-primary font-medium flex-1">Watch on YouTube</Text>
                    <Ionicons name="open-outline" size={14} color="#387F39" />
                  </View>
                </Pressable>
              ) : null}
              <Text className="text-xs text-muted-foreground leading-5">{plan.circleTime.greetingSong.script}</Text>
            </CardContent>
          </Card>

          {/* Goodbye Song */}
          <Card className="mb-4">
            <CardContent>
              <View className="flex-row items-center mb-3">
                <Ionicons name="hand-left" size={16} color="#387F39" style={{ marginRight: 8 }} />
                <Text className="text-sm font-semibold text-foreground">Goodbye Song</Text>
              </View>
              <Text className="text-base font-medium text-primary mb-2">{plan.circleTime.goodbyeSong.title}</Text>
              {plan.circleTime.goodbyeSong.videoUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(plan.circleTime.goodbyeSong.videoUrl)}
                  className="mb-3"
                >
                  <View className="bg-muted rounded-lg p-3 flex-row items-center">
                    <Ionicons name="play-circle" size={24} color="#387F39" style={{ marginRight: 10 }} />
                    <Text className="text-xs text-primary font-medium flex-1">Watch on YouTube</Text>
                    <Ionicons name="open-outline" size={14} color="#387F39" />
                  </View>
                </Pressable>
              ) : null}
              <Text className="text-xs text-muted-foreground leading-5">{plan.circleTime.goodbyeSong.script}</Text>
            </CardContent>
          </Card>

          {/* Yoga Poses */}
          {plan.circleTime.yogaPoses.length > 0 && (
            <>
              <View className="flex-row items-center mb-3 mt-2">
                <Ionicons name="body" size={18} color="#387F39" style={{ marginRight: 8 }} />
                <Text className="text-base font-semibold text-foreground">Yoga Poses</Text>
              </View>
              {plan.circleTime.yogaPoses.map((pose) => (
                <Card key={pose.id} className="mb-4">
                  <CardContent>
                    {pose.imageUrl ? (
                      <Image
                        source={{ uri: pose.imageUrl }}
                        className="w-full rounded-lg mb-3"
                        style={{ height: 160 }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text className="text-base font-medium text-foreground mb-2">{pose.name}</Text>
                    {pose.howTo && pose.howTo.length > 0 && (
                      <View className="mb-2">
                        {pose.howTo.map((step, i) => (
                          <Text key={i} className="text-sm text-muted-foreground leading-5 mb-1">
                            {`${i + 1}. ${step}`}
                          </Text>
                        ))}
                      </View>
                    )}
                    {pose.creativeCues && pose.creativeCues.length > 0 && (
                      <View className="mt-2 bg-muted/50 rounded-lg p-3">
                        {pose.creativeCues.map((cue, i) => (
                          <Text key={i} className="text-sm text-primary italic leading-5">
                            {`"${cue}"`}
                          </Text>
                        ))}
                      </View>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* Music & Movement */}
          {plan.circleTime.musicMovementVideos.length > 0 && (
            <>
              <View className="flex-row items-center mb-3 mt-2">
                <Ionicons name="videocam" size={18} color="#387F39" style={{ marginRight: 8 }} />
                <Text className="text-base font-semibold text-foreground">Music & Movement</Text>
              </View>
              {plan.circleTime.musicMovementVideos.map((video) => (
                <Card key={video.id} className="mb-4">
                  <CardContent>
                    {video.thumbnail ? (
                      <Pressable onPress={() => video.videoUrl && Linking.openURL(video.videoUrl)}>
                        <View className="relative mb-3">
                          <Image
                            source={{ uri: video.thumbnail }}
                            className="w-full rounded-lg"
                            style={{ height: 180 }}
                            resizeMode="cover"
                          />
                          <View className="absolute inset-0 items-center justify-center">
                            <View className="bg-black/50 rounded-full w-12 h-12 items-center justify-center">
                              <Ionicons name="play" size={24} color="#fff" />
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    ) : video.videoUrl ? (
                      <Pressable onPress={() => Linking.openURL(video.videoUrl)} className="mb-3">
                        <View className="bg-muted rounded-lg p-3 flex-row items-center">
                          <Ionicons name="play-circle" size={24} color="#387F39" style={{ marginRight: 10 }} />
                          <Text className="text-xs text-primary font-medium flex-1">Watch on YouTube</Text>
                          <Ionicons name="open-outline" size={14} color="#387F39" />
                        </View>
                      </Pressable>
                    ) : null}
                    <Text className="text-base font-medium text-foreground mb-2">{video.title}</Text>
                    <View className="flex-row flex-wrap gap-2 mb-3">
                      <Badge variant="outline">{`${video.energyLevel} Energy`}</Badge>
                      <Badge variant="outline">{video.duration}</Badge>
                      {video.educator ? <Badge variant="secondary">{video.educator}</Badge> : null}
                    </View>
                    {video.guidance.howToConduct.steps.length > 0 && (
                      <View className="mt-1">
                        <Text className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">How to conduct</Text>
                        {video.guidance.howToConduct.steps.map((step, i) => (
                          <Text key={i} className="text-sm text-muted-foreground leading-5 mb-1">
                            {`${i + 1}. ${step}`}
                          </Text>
                        ))}
                      </View>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Materials List Section ── */}
      {activeSection === "materials" && (
        <ScrollView
          contentContainerClassName="p-4 pb-8"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-lg font-semibold text-foreground mb-1">
            Master Materials List
          </Text>
          <Text className="text-xs text-muted-foreground mb-4">
            {masterMaterials.length} unique items across all activities
          </Text>

          {masterMaterials.length === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No materials listed for this plan.
            </Text>
          ) : (
            <Card>
              <CardContent>
                {masterMaterials.map((material, i) => (
                  <View
                    key={i}
                    className={`flex-row items-center py-2.5 ${
                      i < masterMaterials.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <Ionicons
                      name="ellipse-outline"
                      size={18}
                      color="#387F39"
                      style={{ marginRight: 10 }}
                    />
                    <Text className="text-sm text-foreground flex-1">{material}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}
        </ScrollView>
      )}

      {/* ── Newsletter Section ── */}
      {activeSection === "newsletter" && (
        <ScrollView
          contentContainerClassName="p-4 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {/* Tone toggle */}
          <Card className="mb-4">
            <CardContent>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-foreground">Newsletter Tone</Text>
                <View className="flex-row rounded-lg overflow-hidden border border-border">
                  <Pressable
                    onPress={() => setNewsletterStyle("professional")}
                    style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                    className={newsletterStyle === "professional" ? "bg-primary" : "bg-muted"}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        newsletterStyle === "professional"
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      Professional
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setNewsletterStyle("warm")}
                    style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                    className={newsletterStyle === "warm" ? "bg-primary" : "bg-muted"}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        newsletterStyle === "warm"
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      Warm
                    </Text>
                  </Pressable>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Newsletter content with gradient header */}
          <View className="rounded-xl overflow-hidden border border-border">
            <View className="bg-primary p-5">
              <Text className="text-lg font-semibold text-primary-foreground">
                {`${plan.theme} Week`}
              </Text>
              <Text className="text-xs text-primary-foreground mt-1" style={{ opacity: 0.85 }}>
                {`Week ${plan.weekNumber} \u2022 ${plan.weekRange}`}
              </Text>
            </View>
            <View className="p-5 bg-card">
              <Text className="text-sm text-foreground leading-6">
                {newsletterStyle === "professional"
                  ? plan.newsletter.professional
                  : plan.newsletter.warm}
              </Text>
            </View>
            {plan.domains.length > 0 && (
              <View className="border-t border-border p-4 bg-card">
                <Text className="text-xs text-muted-foreground mb-2">Focus Areas This Week:</Text>
                <View className="flex-row flex-wrap gap-2">
                  {plan.domains.map((domain) => (
                    <Badge key={domain} variant="secondary">{domain}</Badge>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}

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
