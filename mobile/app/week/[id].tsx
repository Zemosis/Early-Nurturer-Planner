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
  TextInput,
  Animated as RNAnimated,
} from "react-native";
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { Swipeable } from "react-native-gesture-handler";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import PagerView from "react-native-pager-view";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchPlanById,
  transformApiPlanToWeekPlan,
  updatePlanSchedule,
  getApiBase,
  DEFAULT_USER_ID,
  type WeekPlan,
  type DetailedActivity,
  useSchedule,
  type ScheduleBlock,
  formatTime12Hour,
  calculateDuration,
  enhanceActivity,
  domainConfig,
  ageGroupConfig,
  mockStudents,
  getInitials,
  formatAge,
} from "shared";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { CollapsibleSection } from "../../components/CollapsibleSection";
import { ScheduleBlockEditor } from "../../components/ScheduleBlockEditor";
import ChatAssistantBottomSheet, { type ChatAssistantRef } from "../../components/ChatAssistantBottomSheet";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SECTION_TABS = [
  { key: "schedule", label: "Schedule" },
  { key: "activities", label: "Activities" },
  { key: "circle", label: "Circle Time" },
  { key: "materials", label: "Materials" },
  { key: "newsletter", label: "Newsletter" },
  { key: "docs", label: "Docs" },
] as const;

type SectionKey = (typeof SECTION_TABS)[number]["key"];

const DEFAULT_PALETTE = { primary: "#387F39", secondary: "#5C8A5E", accent: "#7A9B76", background: "#F5F9F5" };

function getThemeColors(plan: WeekPlan) {
  const p = plan.palette || DEFAULT_PALETTE;
  return { primary: p.primary || DEFAULT_PALETTE.primary, secondary: p.secondary || DEFAULT_PALETTE.secondary, accent: p.accent || DEFAULT_PALETTE.accent, background: p.background || DEFAULT_PALETTE.background };
}

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

function getYouTubeThumbnail(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
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
  const { getSchedule, initializeSchedule, updateBlock, addBlock, deleteBlock, isLocked, toggleLock } = useSchedule();
  const [selectedActivity, setSelectedActivity] = useState<DetailedActivity | null>(null);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(new Set());
  const [savingSchedule, setSavingSchedule] = useState(false);

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

  // Initialize the timed schedule when plan loads — prefer persisted schedule
  useEffect(() => {
    if (!plan) return;
    const wId = `week-${plan.weekNumber}`;
    const existing = getSchedule(wId);
    if (existing.length === 0) {
      const persisted = plan.schedule?.[wId];
      initializeSchedule(wId, persisted && persisted.length > 0 ? persisted : getDefaultSchedule(plan));
    }
  }, [plan]);

  // Persist schedule changes to the backend
  const persistSchedule = useCallback(async (updatedBlocks: ScheduleBlock[]) => {
    if (!plan || !id) return;
    const wId = `week-${plan.weekNumber}`;
    setSavingSchedule(true);
    try {
      await updatePlanSchedule(id, { [wId]: updatedBlocks });
    } catch (e) {
      console.warn("Failed to save schedule:", e);
      Alert.alert("Save failed", "Your schedule changes could not be saved. Please try again.");
    } finally {
      setSavingSchedule(false);
    }
  }, [plan, id]);

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

  const weekId = plan ? `week-${plan.weekNumber}` : "";
  const schedule = plan ? getSchedule(weekId) : [];
  const tc = plan ? getThemeColors(plan) : DEFAULT_PALETTE;

  const detailedActivities = useMemo(() => {
    if (!plan) return [];
    return plan.activities.map((a, i) => enhanceActivity(a, plan, i));
  }, [plan]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={tc.primary} />
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

  // If a detailed activity is selected, show its full view
  if (selectedActivity) {
    return (
      <View className="flex-1 bg-background">
        <View className="px-4 pt-14 pb-3 border-b border-border">
          <Pressable onPress={() => setSelectedActivity(null)}>
            <Text style={{ color: tc.primary }} className="text-base">← Back to Activities</Text>
          </Pressable>
          <View className="flex-row items-center gap-2 mt-2 mb-1">
            <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
            <Text className="text-xs text-muted-foreground">{selectedActivity.day}</Text>
            <Text className="text-xs text-muted-foreground">•</Text>
            <Ionicons name="time-outline" size={14} color="#9CA3AF" />
            <Text className="text-xs text-muted-foreground">{selectedActivity.timeBlock}</Text>
            <Text className="text-xs text-muted-foreground">•</Text>
            <Text className="text-xs text-muted-foreground">{`${selectedActivity.duration} min`}</Text>
          </View>
          <Text className="text-xl font-bold text-foreground">{selectedActivity.title}</Text>
          <View className="flex-row flex-wrap gap-2 mt-2">
            {selectedActivity.domains.map((domain, idx) => {
              const dc = domainConfig[domain];
              return (
                <View key={domain} className="flex-row items-center gap-1 rounded-full px-2.5 py-1 border" style={{ backgroundColor: (dc?.color || tc.primary) + "15", borderColor: dc?.color || tc.primary, borderWidth: idx === 0 ? 2 : 1 }}>
                  <Text style={{ fontSize: 11 }}>{dc?.icon || "🎯"}</Text>
                  <Text style={{ color: dc?.color || tc.primary, fontSize: 11, fontWeight: "500" }}>{domain}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <ScrollView contentContainerClassName="p-4 pb-8" showsVerticalScrollIndicator={false}>
          {/* Activity Overview */}
          <CollapsibleSection title="Activity Overview" icon="information-circle" iconColor={tc.primary} defaultExpanded themeColor={tc.primary}>
            <View className="p-3 rounded-xl mb-3" style={{ backgroundColor: tc.primary + "10", borderLeftWidth: 4, borderLeftColor: tc.primary }}>
              <Text className="text-xs font-medium text-muted-foreground mb-1">Theme Connection</Text>
              <Text className="text-sm text-foreground leading-5">{selectedActivity.themeConnection}</Text>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-muted/30 rounded-lg p-3">
                <Text className="text-xs text-muted-foreground mb-0.5">Duration</Text>
                <Text className="text-sm font-medium text-foreground">{`${selectedActivity.duration} minutes`}</Text>
              </View>
              <View className="flex-1 bg-muted/30 rounded-lg p-3">
                <Text className="text-xs text-muted-foreground mb-0.5">Primary Domain</Text>
                <Text className="text-sm font-medium text-foreground">{selectedActivity.domains[0]}</Text>
              </View>
            </View>
          </CollapsibleSection>

          {/* Developmental Objectives */}
          <CollapsibleSection title="Developmental Objectives" icon="flag" iconColor={tc.primary} defaultExpanded themeColor={tc.primary}>
            {selectedActivity.objectives.map((obj, i) => (
              <View key={i} className="mb-3">
                <View className="flex-row items-center gap-2 mb-1.5">
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: domainConfig[obj.domain]?.color || tc.primary }} />
                  <Text className="text-sm font-medium text-foreground">{obj.domain}</Text>
                </View>
                {obj.goals.map((goal, gi) => (
                  <View key={gi} className="flex-row items-start gap-2 ml-4 mb-1">
                    <Ionicons name="checkbox" size={16} color={tc.primary} style={{ marginTop: 1 }} />
                    <Text className="text-sm text-muted-foreground flex-1">{goal}</Text>
                  </View>
                ))}
              </View>
            ))}
          </CollapsibleSection>

          {/* Materials List */}
          <CollapsibleSection title="Materials List" icon="cube" iconColor={tc.primary} badge={`${selectedActivity.materials.length} items`} themeColor={tc.primary}>
            {selectedActivity.materials.map((mat, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  setCheckedMaterials(prev => {
                    const next = new Set(prev);
                    const key = `${selectedActivity.id}-${i}`;
                    next.has(key) ? next.delete(key) : next.add(key);
                    return next;
                  });
                }}
                className="flex-row items-start gap-3 py-2"
              >
                <Ionicons
                  name={checkedMaterials.has(`${selectedActivity.id}-${i}`) ? "checkbox" : "square-outline"}
                  size={20}
                  color={checkedMaterials.has(`${selectedActivity.id}-${i}`) ? tc.primary : "#D1D5DB"}
                  style={{ marginTop: 1 }}
                />
                <View className="flex-1">
                  <Text className={`text-sm ${checkedMaterials.has(`${selectedActivity.id}-${i}`) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {mat.item}
                  </Text>
                  {mat.quantity && <Text className="text-xs text-muted-foreground">{`(${mat.quantity})`}</Text>}
                  {mat.substitute && <Text className="text-xs text-muted-foreground mt-0.5">{`Substitute: ${mat.substitute}`}</Text>}
                </View>
                {mat.prepRequired && (
                  <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF3C7" }}>
                    <Text style={{ color: "#B45309", fontSize: 10 }}>Prep</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </CollapsibleSection>

          {/* Step-by-Step Instructions */}
          <CollapsibleSection title="Step-by-Step Instructions" icon="list" iconColor={tc.primary} badge={`${selectedActivity.instructions.length} steps`} defaultExpanded themeColor={tc.primary}>
            {selectedActivity.instructions.map((inst) => (
              <View key={inst.step} className="flex-row gap-3 mb-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: tc.primary }}>
                  <Text className="text-xs font-bold text-white">{inst.step}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-0.5">
                    <Text className="text-sm font-medium text-foreground">{inst.title}</Text>
                    {inst.duration && <Text className="text-xs text-muted-foreground">{inst.duration}</Text>}
                  </View>
                  <Text className="text-sm text-muted-foreground leading-5">{inst.description}</Text>
                </View>
              </View>
            ))}
          </CollapsibleSection>

          {/* Age-Level Adaptations */}
          <CollapsibleSection title="Age-Level Adaptations" icon="people" iconColor={tc.primary} themeColor={tc.primary}>
            {selectedActivity.adaptations.map((adapt) => {
              const config = ageGroupConfig[adapt.ageGroup as keyof typeof ageGroupConfig];
              return (
                <CollapsibleSection
                  key={adapt.ageGroup}
                  title={`${config?.icon || ""} ${config?.label || adapt.ageGroup}`}
                  subtitle={adapt.duration}
                  themeColor={config?.color || tc.primary}
                >
                  <Text className="text-sm text-foreground leading-5 mb-2">{adapt.description}</Text>
                  <Text className="text-xs font-medium text-muted-foreground mb-1.5">Key Modifications:</Text>
                  {adapt.modifications.map((mod, mi) => (
                    <View key={mi} className="flex-row items-start gap-2 mb-1">
                      <Text style={{ color: config?.color || tc.primary, marginTop: 4 }}>•</Text>
                      <Text className="text-sm text-muted-foreground flex-1">{mod}</Text>
                    </View>
                  ))}
                </CollapsibleSection>
              );
            })}
          </CollapsibleSection>

          {/* Differentiation & Support */}
          <CollapsibleSection title="Differentiation & Support" icon="bulb" iconColor={tc.primary} themeColor={tc.primary}>
            {selectedActivity.differentiation.map((strat, si) => (
              <View key={si} className="mb-3">
                <Text className="text-sm font-medium text-foreground mb-1.5">{strat.title}</Text>
                {strat.strategies.map((s, idx) => (
                  <View key={idx} className="flex-row items-start gap-2 mb-1 ml-1">
                    <Text style={{ color: tc.primary, marginTop: 4 }}>•</Text>
                    <Text className="text-sm text-muted-foreground flex-1">{s}</Text>
                  </View>
                ))}
              </View>
            ))}
          </CollapsibleSection>

          {/* Observation Prompts */}
          <CollapsibleSection title="Observation Prompts" icon="eye" iconColor={tc.primary} subtitle="Licensing-friendly documentation" themeColor={tc.primary}>
            {selectedActivity.observationPrompts.map((prompt, pi) => (
              <View key={pi} className="mb-3">
                <Text className="text-sm font-medium text-foreground mb-1.5">{prompt.category}</Text>
                {prompt.prompts.map((p, idx) => (
                  <View key={idx} className="flex-row items-start gap-2 mb-1 ml-1">
                    <Ionicons name="checkbox" size={14} color={tc.primary} style={{ marginTop: 2 }} />
                    <Text className="text-sm text-muted-foreground flex-1">{p}</Text>
                  </View>
                ))}
              </View>
            ))}
          </CollapsibleSection>

          {/* Teacher Reflection */}
          <CollapsibleSection title="Teacher Reflection" icon="chatbubbles" iconColor={tc.primary} subtitle="Optional - for your growth" themeColor={tc.primary}>
            {selectedActivity.reflectionPrompts.map((prompt, pi) => (
              <View key={pi} className="flex-row items-start gap-2 mb-1.5">
                <Text style={{ color: tc.primary, marginTop: 4 }}>•</Text>
                <Text className="text-sm text-muted-foreground flex-1">{prompt}</Text>
              </View>
            ))}
            <View className="mt-3">
              <Text className="text-sm font-medium text-foreground mb-2">Your Reflections</Text>
              <TextInput
                placeholder="What worked well? What would you adjust next time?"
                multiline
                numberOfLines={4}
                className="border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                placeholderTextColor="#9CA3AF"
                style={{ textAlignVertical: "top", minHeight: 80 }}
              />
            </View>
          </CollapsibleSection>
        </ScrollView>
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
            <Text style={{ color: tc.primary }} className="text-base">← Back</Text>
          </Pressable>
          <Pressable
            onPress={handleDownloadPDF}
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: tc.primary }}
          >
            <Text className="text-xs font-semibold text-white">
              {downloading ? "Downloading…" : "Download PDF"}
            </Text>
          </Pressable>
        </View>
        <Text className="text-xl font-bold text-foreground mt-2">
          {plan.themeEmoji} {plan.theme}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {`Week ${plan.weekNumber} \u00B7 ${plan.weekRange}`}
        </Text>
        {plan.domains.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-2">
            {plan.domains.map((d) => (
              <View key={d} className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: tc.primary + "15" }}>
                <Text style={{ color: tc.primary, fontSize: 11, fontWeight: "500" }}>{d}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Section tabs — themed */}
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
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: activeSection === tab.key ? tc.primary : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "500",
                  color: activeSection === tab.key ? "#fff" : "#9CA3AF",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Timed Daily Schedule Section (Editable) ── */}
      {activeSection === "schedule" && (
        <View style={{ flex: 1 }}>
          <DraggableFlatList
            data={schedule}
            keyExtractor={(item) => item.id}
            activationDistance={isLocked ? 999 : 10}
            onDragEnd={({ data }) => {
              initializeSchedule(weekId, data);
              persistSchedule(data);
            }}
            ListHeaderComponent={
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-lg font-semibold text-foreground">Daily Flow</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-muted-foreground">{`${schedule.length} blocks`}</Text>
                    {savingSchedule && (
                      <View className="flex-row items-center gap-1">
                        <ActivityIndicator size="small" color={tc.primary} />
                        <Text className="text-xs" style={{ color: tc.primary }}>Saving…</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={toggleLock}
                  className="flex-row items-center gap-1.5 rounded-lg px-3 py-2 border"
                  style={{ borderColor: isLocked ? "#D1D5DB" : tc.primary, backgroundColor: isLocked ? "transparent" : tc.primary + "10" }}
                >
                  <Ionicons name={isLocked ? "lock-closed" : "lock-open"} size={14} color={isLocked ? "#9CA3AF" : tc.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "500", color: isLocked ? "#9CA3AF" : tc.primary }}>
                    {isLocked ? "Locked" : "Editing"}
                  </Text>
                </Pressable>
              </View>
            }
            ListFooterComponent={
              !isLocked ? (
                <Pressable
                  onPress={() => { setEditingBlock(null); setEditorVisible(true); }}
                  className="rounded-xl border-2 border-dashed border-border p-4 items-center justify-center mb-8"
                >
                  <Ionicons name="add-circle-outline" size={24} color={tc.primary} />
                  <Text style={{ color: tc.primary, fontSize: 13, fontWeight: "500", marginTop: 4 }}>Add Block</Text>
                </Pressable>
              ) : <View style={{ height: 32 }} />
            }
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: block, drag, isActive }: RenderItemParams<ScheduleBlock>) => {
              const colors = CATEGORY_COLORS[block.category] || CATEGORY_COLORS.routine;
              const duration = calculateDuration(block.startTime, block.endTime);

              const renderRightActions = (_progress: RNAnimated.AnimatedInterpolation<number>, dragX: RNAnimated.AnimatedInterpolation<number>) => {
                const scale = dragX.interpolate({
                  inputRange: [-80, 0],
                  outputRange: [1, 0.5],
                  extrapolate: "clamp",
                });
                return (
                  <Pressable
                    onPress={() => {
                      deleteBlock(weekId, block.id);
                      const updated = getSchedule(weekId).filter(b => b.id !== block.id);
                      persistSchedule(updated);
                    }}
                    style={{ backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center", width: 80, borderRadius: 12, marginBottom: 12, marginLeft: 8 }}
                  >
                    <RNAnimated.View style={{ transform: [{ scale }] }}>
                      <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600", marginTop: 2 }}>Delete</Text>
                    </RNAnimated.View>
                  </Pressable>
                );
              };

              const card = (
                <Pressable
                  onPress={() => {
                    if (!isLocked) {
                      setEditingBlock(block);
                      setEditorVisible(true);
                    }
                  }}
                  className="rounded-xl overflow-hidden mb-3"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: colors.border,
                    backgroundColor: colors.bg,
                    opacity: isActive ? 0.9 : 1,
                    elevation: isActive ? 8 : 0,
                    shadowColor: isActive ? "#000" : "transparent",
                    shadowOffset: { width: 0, height: isActive ? 4 : 0 },
                    shadowOpacity: isActive ? 0.2 : 0,
                    shadowRadius: isActive ? 8 : 0,
                  }}
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
                      <View className="flex-row items-center gap-2">
                        <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: "white" }}>
                          <Text style={{ color: colors.border, fontSize: 11, fontWeight: "600" }}>{`${duration}m`}</Text>
                        </View>
                        {!isLocked && <Ionicons name="create-outline" size={14} color="#9CA3AF" />}
                        {!isLocked && (
                          <Pressable onLongPress={drag} delayLongPress={100} hitSlop={8}>
                            <Ionicons name="menu" size={18} color="#9CA3AF" />
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <Text className="text-xs text-muted-foreground mt-1">{block.description}</Text>
                  </View>
                </Pressable>
              );

              return (
                <ScaleDecorator>
                  {!isLocked ? (
                    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
                      {card}
                    </Swipeable>
                  ) : card}
                </ScaleDecorator>
              );
            }}
          />
          <ScheduleBlockEditor
            visible={editorVisible}
            block={editingBlock}
            themeColor={tc.primary}
            onSave={(saved) => {
              if (editingBlock) {
                updateBlock(weekId, saved.id, saved);
              } else {
                addBlock(weekId, saved);
              }
              const current = getSchedule(weekId);
              let updated: ScheduleBlock[];
              if (editingBlock) {
                updated = current.map(b => b.id === saved.id ? { ...b, ...saved } : b);
              } else {
                updated = [...current, { ...saved, id: saved.id || `block-${Date.now()}` }]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
              }
              persistSchedule(updated);
            }}
            onDelete={(blockId) => {
              deleteBlock(weekId, blockId);
              const updated = getSchedule(weekId).filter(b => b.id !== blockId);
              persistSchedule(updated);
            }}
            onClose={() => { setEditorVisible(false); setEditingBlock(null); }}
          />
        </View>
      )}

      {/* ── Activities Section (Rich, with day tabs) ── */}
      {activeSection === "activities" && (
        <View style={{ flex: 1 }}>
          <View className="flex-row border-b border-border">
            {DAYS.map((day, i) => (
              <Pressable
                key={day}
                onPress={() => {
                  setActiveDay(i);
                  pagerRef.current?.setPage(i);
                }}
                style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: activeDay === i ? 2 : 0, borderBottomColor: tc.primary }}
              >
                <Text style={{ fontSize: 12, fontWeight: "500", color: activeDay === i ? tc.primary : "#9CA3AF" }}>
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
            {DAYS.map((day, dayIndex) => {
              const dayActivities = detailedActivities.filter((a) => a.day === day);
              return (
                <ScrollView
                  key={day}
                  contentContainerClassName="p-4 pb-8"
                  showsVerticalScrollIndicator={false}
                >
                  <Text className="text-lg font-semibold text-foreground mb-1">{day}</Text>
                  <Text className="text-xs text-muted-foreground mb-4">
                    {dayActivities.length === 0 ? "No activities" : `${dayActivities.length} ${dayActivities.length === 1 ? "activity" : "activities"}`}
                  </Text>

                  {dayActivities.length === 0 ? (
                    <View className="bg-muted/30 rounded-xl p-6 items-center">
                      <Ionicons name="calendar-outline" size={28} color="#D1D5DB" />
                      <Text className="text-sm text-muted-foreground mt-2">No activities scheduled</Text>
                    </View>
                  ) : (
                    dayActivities.map((activity) => {
                      const dc = domainConfig[activity.domains[0]];
                      return (
                        <Pressable
                          key={activity.id}
                          onPress={() => setSelectedActivity(activity)}
                          className="mb-4 rounded-xl overflow-hidden border border-border bg-card"
                          style={{ borderLeftWidth: 4, borderLeftColor: dc?.color || tc.primary }}
                        >
                          <View className="p-4">
                            <View className="flex-row items-center justify-between mb-2">
                              <Text className="text-base font-semibold text-foreground flex-1 mr-2">
                                {activity.title}
                              </Text>
                              <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: (dc?.color || tc.primary) + "15" }}>
                                <Text style={{ fontSize: 10 }}>{dc?.icon || ""}</Text>
                                <Text style={{ color: dc?.color || tc.primary, fontSize: 10, fontWeight: "600" }}>{activity.domains[0]}</Text>
                              </View>
                            </View>

                            <Text className="text-sm text-muted-foreground leading-5" numberOfLines={2}>
                              {activity.themeConnection}
                            </Text>

                            <View className="flex-row items-center gap-3 mt-3">
                              <View className="flex-row items-center gap-1">
                                <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                                <Text className="text-xs text-muted-foreground">{`${activity.duration} min`}</Text>
                              </View>
                              <View className="flex-row items-center gap-1">
                                <Ionicons name="cube-outline" size={12} color="#9CA3AF" />
                                <Text className="text-xs text-muted-foreground">{`${activity.materials.length} materials`}</Text>
                              </View>
                              <View className="flex-1" />
                              <View className="flex-row items-center gap-1">
                                <Text style={{ color: tc.primary, fontSize: 12, fontWeight: "500" }}>View Details</Text>
                                <Ionicons name="chevron-forward" size={14} color={tc.primary} />
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              );
            })}
          </PagerView>
        </View>
      )}


      {/* ── Circle Time Section ── */}
      {activeSection === "circle" && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerClassName="p-4 pb-8"
            showsVerticalScrollIndicator={false}
          >
            {/* Basics */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>
                  <View className="flex-row items-center">
                    <Ionicons name="book" size={16} color={tc.primary} style={{ marginRight: 8 }} />
                    <Text className="text-base font-semibold text-foreground">This Week's Focus</Text>
                  </View>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="flex-row justify-around">
                  <View className="items-center px-2">
                    <Text className="text-3xl font-bold" style={{ color: tc.primary }}>{plan.circleTime.letter}</Text>
                    <Text className="text-xs text-muted-foreground mt-1">Letter</Text>
                    {plan.circleTime.letterWord && (
                      <Text className="text-xs text-muted-foreground">({plan.circleTime.letterWord})</Text>
                    )}
                  </View>
                  <View className="items-center px-2">
                    <Text className="text-3xl font-bold" style={{ color: tc.primary }}>{plan.circleTime.shape}</Text>
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
                    <Text className="text-3xl font-bold" style={{ color: tc.primary }}>{plan.circleTime.countingTo}</Text>
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
                  <Ionicons name="musical-notes" size={16} color={tc.primary} style={{ marginRight: 8 }} />
                  <Text className="text-sm font-semibold text-foreground">Greeting Song</Text>
                </View>
                <Text className="text-base font-medium mb-2" style={{ color: tc.primary }}>{plan.circleTime.greetingSong.title}</Text>
                {plan.circleTime.greetingSong.videoUrl ? (() => {
                  const thumb = getYouTubeThumbnail(plan.circleTime.greetingSong.videoUrl);
                  return thumb ? (
                    <Pressable onPress={() => Linking.openURL(plan.circleTime.greetingSong.videoUrl)} className="mb-3">
                      <View className="relative">
                        <Image source={{ uri: thumb }} className="w-full rounded-lg" style={{ height: 180 }} resizeMode="cover" />
                        <View className="absolute inset-0 items-center justify-center">
                          <View className="bg-black/50 rounded-full w-12 h-12 items-center justify-center">
                            <Ionicons name="play" size={24} color="#fff" />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => Linking.openURL(plan.circleTime.greetingSong.videoUrl)} className="mb-3">
                      <View className="bg-muted rounded-lg p-3 flex-row items-center">
                        <Ionicons name="play-circle" size={24} color={tc.primary} style={{ marginRight: 10 }} />
                        <Text className="text-xs font-medium flex-1" style={{ color: tc.primary }}>Watch on YouTube</Text>
                        <Ionicons name="open-outline" size={14} color={tc.primary} />
                      </View>
                    </Pressable>
                  );
                })() : null}
                <Text className="text-xs text-muted-foreground leading-5">{plan.circleTime.greetingSong.script}</Text>
              </CardContent>
            </Card>

            {/* Goodbye Song */}
            <Card className="mb-4">
              <CardContent>
                <View className="flex-row items-center mb-3">
                  <Ionicons name="hand-left" size={16} color={tc.primary} style={{ marginRight: 8 }} />
                  <Text className="text-sm font-semibold text-foreground">Goodbye Song</Text>
                </View>
                <Text className="text-base font-medium mb-2" style={{ color: tc.primary }}>{plan.circleTime.goodbyeSong.title}</Text>
                {plan.circleTime.goodbyeSong.videoUrl ? (() => {
                  const thumb = getYouTubeThumbnail(plan.circleTime.goodbyeSong.videoUrl);
                  return thumb ? (
                    <Pressable onPress={() => Linking.openURL(plan.circleTime.goodbyeSong.videoUrl)} className="mb-3">
                      <View className="relative">
                        <Image source={{ uri: thumb }} className="w-full rounded-lg" style={{ height: 180 }} resizeMode="cover" />
                        <View className="absolute inset-0 items-center justify-center">
                          <View className="bg-black/50 rounded-full w-12 h-12 items-center justify-center">
                            <Ionicons name="play" size={24} color="#fff" />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => Linking.openURL(plan.circleTime.goodbyeSong.videoUrl)} className="mb-3">
                      <View className="bg-muted rounded-lg p-3 flex-row items-center">
                        <Ionicons name="play-circle" size={24} color={tc.primary} style={{ marginRight: 10 }} />
                        <Text className="text-xs font-medium flex-1" style={{ color: tc.primary }}>Watch on YouTube</Text>
                        <Ionicons name="open-outline" size={14} color={tc.primary} />
                      </View>
                    </Pressable>
                  );
                })() : null}
                <Text className="text-xs text-muted-foreground leading-5">{plan.circleTime.goodbyeSong.script}</Text>
              </CardContent>
            </Card>

            {/* Yoga Poses */}
            {plan.circleTime.yogaPoses.length > 0 && (
              <>
                <View className="flex-row items-center mb-3 mt-2">
                  <Ionicons name="body" size={18} color={tc.primary} style={{ marginRight: 8 }} />
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
                            <Text key={i} className="text-sm italic leading-5" style={{ color: tc.primary }}>
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
                  <Ionicons name="videocam" size={18} color={tc.primary} style={{ marginRight: 8 }} />
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
                            <Ionicons name="play-circle" size={24} color={tc.primary} style={{ marginRight: 10 }} />
                            <Text className="text-xs font-medium flex-1" style={{ color: tc.primary }}>Watch on YouTube</Text>
                            <Ionicons name="open-outline" size={14} color={tc.primary} />
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
        </View>
      )}

      {/* ── Materials List Section ── */}
      {activeSection === "materials" && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerClassName="p-4 pb-8"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-lg font-semibold text-foreground mb-1">
              Master Materials List
            </Text>
            <Text className="text-xs text-muted-foreground mb-4">
              {`${masterMaterials.length} unique items across all activities`}
            </Text>

            {masterMaterials.length === 0 ? (
              <Text className="text-muted-foreground text-sm">
                No materials listed for this plan.
              </Text>
            ) : (
              <Card>
                <CardContent>
                  {masterMaterials.map((material, i) => {
                    const isChecked = checkedMaterials.has(material);
                    return (
                      <Pressable
                        key={i}
                        onPress={() => {
                          setCheckedMaterials((prev) => {
                            const next = new Set(prev);
                            if (next.has(material)) next.delete(material);
                            else next.add(material);
                            return next;
                          });
                        }}
                        className={`flex-row items-center py-2.5 ${
                          i < masterMaterials.length - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <Ionicons
                          name={isChecked ? "checkmark-circle" : "ellipse-outline"}
                          size={20}
                          color={isChecked ? tc.primary : "#D1D5DB"}
                          style={{ marginRight: 10 }}
                        />
                        <Text
                          className="text-sm flex-1"
                          style={{ color: isChecked ? "#9CA3AF" : "#1a1a1a", textDecorationLine: isChecked ? "line-through" : "none" }}
                        >
                          {material}
                        </Text>
                      </Pressable>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </ScrollView>
        </View>
      )}

      {/* ── Newsletter Section ── */}
      {activeSection === "newsletter" && (
        <View style={{ flex: 1 }}>
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
                      style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: newsletterStyle === "professional" ? tc.primary : undefined }}
                      className={newsletterStyle !== "professional" ? "bg-muted" : ""}
                    >
                      <Text
                        style={{ fontSize: 12, fontWeight: "500", color: newsletterStyle === "professional" ? "#fff" : "#9CA3AF" }}
                      >
                        Professional
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setNewsletterStyle("warm")}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: newsletterStyle === "warm" ? tc.primary : undefined }}
                      className={newsletterStyle !== "warm" ? "bg-muted" : ""}
                    >
                      <Text
                        style={{ fontSize: 12, fontWeight: "500", color: newsletterStyle === "warm" ? "#fff" : "#9CA3AF" }}
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
              <View style={{ backgroundColor: tc.primary }} className="p-5">
                <Text className="text-lg font-semibold text-white">
                  {`${plan.theme} Week`}
                </Text>
                <Text className="text-xs text-white mt-1" style={{ opacity: 0.85 }}>
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
                      <View key={domain} className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: tc.primary + "15" }}>
                        <Text style={{ color: tc.primary, fontSize: 11, fontWeight: "500" }}>{domain}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── Documentation Section (Read-only) ── */}
      {activeSection === "docs" && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerClassName="p-4 pb-8"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-lg font-semibold text-foreground mb-1">Student Documentation</Text>
            <Text className="text-xs text-muted-foreground mb-4">
              {`${mockStudents.length} students \u2022 Week ${plan.weekNumber}`}
            </Text>

            {mockStudents.length === 0 ? (
              <View className="bg-muted/30 rounded-xl p-8 items-center">
                <Ionicons name="people-outline" size={32} color="#D1D5DB" />
                <Text className="text-sm text-muted-foreground mt-2">No students yet</Text>
              </View>
            ) : (
              <View className="gap-3">
                {mockStudents.map((student) => {
                  const AGE_HEX: Record<string, { bg: string; text: string; border: string }> = {
                    "0-12m": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
                    "12-24m": { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
                    "24-36m": { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
                  };
                  const ageColors = AGE_HEX[student.age.group] || AGE_HEX["12-24m"];
                  return (
                    <Card key={student.id} className="overflow-hidden">
                      <CardContent>
                        <View className="flex-row items-start gap-3">
                          <View
                            className="w-12 h-12 rounded-xl items-center justify-center"
                            style={{ backgroundColor: tc.primary + "20" }}
                          >
                            <Text style={{ color: tc.primary, fontSize: 16, fontWeight: "600" }}>
                              {getInitials(student.name)}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-foreground">{student.name}</Text>
                            <Text className="text-xs text-muted-foreground">{formatAge(student.age.months)}</Text>
                            <View className="flex-row items-center gap-2 mt-1.5">
                              <View
                                className="rounded-md px-2 py-0.5"
                                style={{ backgroundColor: ageColors.bg, borderWidth: 1, borderColor: ageColors.border }}
                              >
                                <Text style={{ color: ageColors.text, fontSize: 10, fontWeight: "500" }}>{student.age.group}</Text>
                              </View>
                              {student.tags?.filter((tag) => tag !== student.age.group).slice(0, 2).map((tag) => (
                                <View key={tag} className="rounded-md px-2 py-0.5" style={{ backgroundColor: "#F3F4F6" }}>
                                  <Text className="text-xs text-muted-foreground">{tag}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                          <View
                            className="w-3 h-3 rounded-full mt-1"
                            style={{ backgroundColor: student.isActive ? "#22C55E" : "#D1D5DB" }}
                          />
                        </View>
                        {student.notes && (
                          <Text className="text-xs text-muted-foreground mt-2 leading-4" numberOfLines={2}>
                            {student.notes}
                          </Text>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Floating chat button */}
      <Pressable
        onPress={() => chatSheetRef.current?.open()}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 5, backgroundColor: tc.primary }}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </Pressable>

      <ChatAssistantBottomSheet ref={chatSheetRef} />
    </View>
  );
}
