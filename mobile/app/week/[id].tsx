import { useCallback, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
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
} from "shared";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import ChatAssistantBottomSheet, { type ChatAssistantRef } from "../../components/ChatAssistantBottomSheet";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SECTION_TABS = [
  { key: "schedule", label: "Daily Schedule", icon: "calendar" as const },
  { key: "objectives", label: "Objectives", icon: "flag" as const },
  { key: "circle", label: "Circle Time", icon: "people" as const },
  { key: "materials", label: "Materials", icon: "cart" as const },
  { key: "newsletter", label: "Newsletter", icon: "mail" as const },
] as const;

type SectionKey = (typeof SECTION_TABS)[number]["key"];

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

      {/* Section pill tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {SECTION_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveSection(tab.key)}
            className={`flex-row items-center px-3.5 py-2 rounded-full ${
              activeSection === tab.key
                ? "bg-primary"
                : "bg-muted"
            }`}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={activeSection === tab.key ? "#fff" : "#5C6B5E"}
              style={{ marginRight: 5 }}
            />
            <Text
              className={`text-xs font-medium ${
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

      {/* ── Daily Schedule Section ── */}
      {activeSection === "schedule" && (
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
          <Text className="text-lg font-semibold text-foreground mb-4">
            Circle Time
          </Text>

          {/* Basics */}
          <Card className="mb-3">
            <CardHeader>
              <CardTitle>
                <View className="flex-row items-center">
                  <Ionicons name="book" size={16} color="#387F39" style={{ marginRight: 8 }} />
                  <Text className="text-base font-semibold text-foreground">Basics</Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex-row flex-wrap gap-3">
                <View className="items-center">
                  <Text className="text-2xl font-bold text-primary">{plan.circleTime.letter}</Text>
                  <Text className="text-xs text-muted-foreground">Letter</Text>
                  {plan.circleTime.letterWord && (
                    <Text className="text-xs text-muted-foreground">({plan.circleTime.letterWord})</Text>
                  )}
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-primary">{plan.circleTime.shape}</Text>
                  <Text className="text-xs text-muted-foreground">Shape</Text>
                </View>
                <View className="items-center">
                  <View
                    className="w-8 h-8 rounded-full mb-0.5"
                    style={{ backgroundColor: plan.circleTime.color.toLowerCase() }}
                  />
                  <Text className="text-xs text-muted-foreground">{plan.circleTime.color}</Text>
                  {plan.circleTime.colorObject && (
                    <Text className="text-xs text-muted-foreground">({plan.circleTime.colorObject})</Text>
                  )}
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-primary">{plan.circleTime.countingTo}</Text>
                  <Text className="text-xs text-muted-foreground">Count to</Text>
                  {plan.circleTime.countingObject && (
                    <Text className="text-xs text-muted-foreground">({plan.circleTime.countingObject})</Text>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Songs */}
          <Card className="mb-3">
            <CardHeader>
              <CardTitle>
                <View className="flex-row items-center">
                  <Ionicons name="musical-notes" size={16} color="#387F39" style={{ marginRight: 8 }} />
                  <Text className="text-base font-semibold text-foreground">Songs</Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="mb-3">
                <Text className="text-sm font-medium text-foreground">Greeting Song</Text>
                <Text className="text-sm text-primary mt-0.5">{plan.circleTime.greetingSong.title}</Text>
                <Text className="text-xs text-muted-foreground mt-1">{plan.circleTime.greetingSong.script}</Text>
              </View>
              <View className="border-t border-border pt-3">
                <Text className="text-sm font-medium text-foreground">Goodbye Song</Text>
                <Text className="text-sm text-primary mt-0.5">{plan.circleTime.goodbyeSong.title}</Text>
                <Text className="text-xs text-muted-foreground mt-1">{plan.circleTime.goodbyeSong.script}</Text>
              </View>
            </CardContent>
          </Card>

          {/* Yoga Poses */}
          {plan.circleTime.yogaPoses.length > 0 && (
            <Card className="mb-3">
              <CardHeader>
                <CardTitle>
                  <View className="flex-row items-center">
                    <Ionicons name="body" size={16} color="#387F39" style={{ marginRight: 8 }} />
                    <Text className="text-base font-semibold text-foreground">Yoga Poses</Text>
                  </View>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plan.circleTime.yogaPoses.map((pose) => (
                  <View key={pose.id} className="mb-3 last:mb-0">
                    <Text className="text-sm font-medium text-foreground">{pose.name}</Text>
                    {pose.howTo && pose.howTo.length > 0 && (
                      <View className="mt-1">
                        {pose.howTo.map((step, i) => (
                          <Text key={i} className="text-xs text-muted-foreground">
                            {i + 1}. {step}
                          </Text>
                        ))}
                      </View>
                    )}
                    {pose.creativeCues && pose.creativeCues.length > 0 && (
                      <View className="mt-1">
                        {pose.creativeCues.map((cue, i) => (
                          <Text key={i} className="text-xs text-primary italic">
                            "{cue}"
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Music & Movement */}
          {plan.circleTime.musicMovementVideos.length > 0 && (
            <Card className="mb-3">
              <CardHeader>
                <CardTitle>
                  <View className="flex-row items-center">
                    <Ionicons name="videocam" size={16} color="#387F39" style={{ marginRight: 8 }} />
                    <Text className="text-base font-semibold text-foreground">Music & Movement</Text>
                  </View>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plan.circleTime.musicMovementVideos.map((video) => (
                  <View key={video.id} className="mb-3 last:mb-0">
                    <Text className="text-sm font-medium text-foreground">{video.title}</Text>
                    <View className="flex-row flex-wrap gap-1.5 mt-1">
                      <Badge variant="outline">{video.energyLevel} Energy</Badge>
                      <Badge variant="outline">{video.duration}</Badge>
                      {video.educator && <Badge variant="secondary">{video.educator}</Badge>}
                    </View>
                    {video.guidance.howToConduct.steps.length > 0 && (
                      <View className="mt-2">
                        <Text className="text-xs font-medium text-foreground mb-0.5">How to conduct</Text>
                        {video.guidance.howToConduct.steps.map((step, i) => (
                          <Text key={i} className="text-xs text-muted-foreground">
                            {i + 1}. {step}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </CardContent>
            </Card>
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
          <Text className="text-lg font-semibold text-foreground mb-3">
            Newsletter
          </Text>

          {/* Style toggle */}
          <View className="flex-row mb-4 rounded-lg overflow-hidden border border-border">
            <Pressable
              onPress={() => setNewsletterStyle("professional")}
              className={`flex-1 items-center py-2.5 ${
                newsletterStyle === "professional" ? "bg-primary" : "bg-muted"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
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
              className={`flex-1 items-center py-2.5 ${
                newsletterStyle === "warm" ? "bg-primary" : "bg-muted"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  newsletterStyle === "warm"
                    ? "text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Warm & Friendly
              </Text>
            </Pressable>
          </View>

          <Card>
            <CardContent>
              <Text className="text-sm text-foreground leading-6">
                {newsletterStyle === "professional"
                  ? plan.newsletter.professional
                  : plan.newsletter.warm}
              </Text>
            </CardContent>
          </Card>
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
