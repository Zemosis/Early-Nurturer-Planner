import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { usePlanner, fetchAllPlans, type WeekPlanSummary } from "shared";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export default function DashboardScreen() {
  const { allPlans, setAllPlans } = usePlanner();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const plans = await fetchAllPlans();
          if (!cancelled) {
            setAllPlans(plans);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) setError("Failed to load plans. Check your connection.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#387F39" />
        <Text className="text-muted-foreground text-sm mt-3">Loading plans...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-destructive text-base text-center">{error}</Text>
      </View>
    );
  }

  if (allPlans.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-4xl mb-3">📋</Text>
        <Text className="text-foreground text-lg font-semibold text-center">No plans yet</Text>
        <Text className="text-muted-foreground text-sm text-center mt-1">
          Generate your first weekly plan from the web app to see it here.
        </Text>
      </View>
    );
  }

  const renderPlanCard = ({ item }: { item: WeekPlanSummary }) => (
    <Pressable onPress={() => router.push(`/week/${item.id}`)}>
      <Card className="mb-3">
        <CardHeader>
          <CardTitle>{`${item.theme_emoji} ${item.theme}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-muted-foreground mb-2">
            Week {item.global_week_number} &middot; {item.week_range}
          </Text>
          {item.domains && item.domains.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5">
              {item.domains.map((domain) => (
                <Badge key={domain} variant="secondary">
                  {domain}
                </Badge>
              ))}
            </View>
          )}
        </CardContent>
      </Card>
    </Pressable>
  );

  const recentPlans = allPlans.slice(0, 3);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-14 pb-3">
        <Text className="text-2xl font-bold text-foreground">My Plans</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          {allPlans.length} weekly {allPlans.length === 1 ? "plan" : "plans"}
        </Text>
      </View>
      <FlatList
        data={recentPlans}
        keyExtractor={(item) => item.id}
        renderItem={renderPlanCard}
        contentContainerClassName="px-4 pb-6"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          allPlans.length > 3 ? (
            <Text className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Recent Plans
            </Text>
          ) : null
        }
        ListFooterComponent={
          allPlans.length > 3 ? (
            <Pressable
              onPress={() => router.push("/calendar")}
              className="mt-2 py-3 items-center rounded-lg border border-primary"
            >
              <Text className="text-primary font-semibold text-sm">
                View Full Calendar
              </Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
