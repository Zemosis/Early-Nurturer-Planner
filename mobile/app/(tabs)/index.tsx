import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { usePlanner, fetchAllPlans, type WeekPlanSummary } from "shared";

export default function DashboardScreen() {
  const { allPlans, setAllPlans } = usePlanner();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadPlans = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const plans = await fetchAllPlans();
      setAllPlans(plans);
      setError(null);
    } catch (e) {
      setError("Failed to load plans. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
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

  if (error && allPlans.length === 0) {
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

  const renderPlanCard = ({ item }: { item: WeekPlanSummary }) => {
    const planColor = item.palette?.primary || "#387F39";
    return (
      <Pressable onPress={() => router.push(`/week/${item.id}`)}>
        <View
          className="mb-3 rounded-xl overflow-hidden border border-border bg-card"
          style={{ borderLeftWidth: 4, borderLeftColor: planColor }}
        >
          <View className="p-4">
            <Text className="text-base font-semibold text-foreground">{`${item.theme_emoji} ${item.theme}`}</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              {`Week ${item.global_week_number} \u00B7 ${item.week_range}`}
            </Text>
            {item.domains && item.domains.length > 0 && (
              <View className="flex-row flex-wrap gap-1.5 mt-2">
                {item.domains.map((domain) => (
                  <View key={domain} className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: planColor + "15" }}>
                    <Text style={{ color: planColor, fontSize: 11, fontWeight: "500" }}>{domain}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const listHeader = (
    <View className="pb-3 pt-2">
      <Text className="text-2xl font-bold text-foreground">My Plans</Text>
      <Text className="text-sm text-muted-foreground mt-1">
        {allPlans.length} weekly {allPlans.length === 1 ? "plan" : "plans"}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={allPlans}
        keyExtractor={(item) => item.id}
        renderItem={renderPlanCard}
        ListHeaderComponent={listHeader}
        contentContainerClassName="px-4 pb-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadPlans(true)} tintColor="#387F39" colors={["#387F39"]} />
        }
      />
    </View>
  );
}
