import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import {
  usePlanner,
  fetchThemePool,
  refreshThemePool,
  generatePlan,
  transformApiThemeToThemeDetail,
  transformApiPlanToWeekPlan,
  type ThemePoolItem,
} from "shared";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export default function ThemesScreen() {
  const {
    themePool,
    setThemePool,
    isGenerating,
    setIsGenerating,
    setCurrentPlan,
    setCurrentPlanId,
  } = usePlanner();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadPool = useCallback(async () => {
    try {
      const response = await fetchThemePool();
      setThemePool(response.themes);
      setFetchError(null);
    } catch {
      setFetchError("Failed to load themes. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await refreshThemePool([]);
      setThemePool(response.themes);
    } catch {
      Alert.alert("Error", "Failed to refresh themes.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectTheme = (item: ThemePoolItem) => {
    const theme = transformApiThemeToThemeDetail(item.theme_data);
    Alert.alert(
      `Generate Plan: ${theme.emoji} ${theme.name}`,
      "AI will create a full weekly curriculum based on this theme. This takes 10-20 seconds.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => handleGenerate(item),
        },
      ]
    );
  };

  const handleGenerate = async (item: ThemePoolItem) => {
    setIsGenerating(true);
    try {
      const result = await generatePlan({
        selectedTheme: item.theme_data,
        themePoolId: item.id,
      });
      const plan = transformApiPlanToWeekPlan({ ...result.plan, id: result.plan_id });
      setCurrentPlan(plan);
      if (result.plan_id) {
        setCurrentPlanId(result.plan_id);
      }
      await loadPool();
      if (result.plan_id) {
        router.push(`/week/${result.plan_id}`);
      }
    } catch (e) {
      Alert.alert(
        "Generation Failed",
        e instanceof Error ? e.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const renderThemeCard = ({ item }: { item: ThemePoolItem }) => {
    const theme = transformApiThemeToThemeDetail(item.theme_data);
    return (
      <Pressable onPress={() => handleSelectTheme(item)}>
        <Card className="mb-3">
          <CardHeader>
            <CardTitle>{`${theme.emoji} ${theme.name}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {theme.mood ? (
              <Text className="text-sm text-muted-foreground mb-2">
                {theme.mood}
              </Text>
            ) : null}
            {theme.atmosphere.length > 0 && (
              <View className="flex-row flex-wrap gap-1.5 mb-2">
                {theme.atmosphere.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </View>
            )}
            {theme.palette?.hex && (
              <View className="flex-row gap-1.5 mt-1">
                {Object.entries(theme.palette.hex).map(([key, color]) => (
                  <View
                    key={key}
                    style={{ backgroundColor: color }}
                    className="w-6 h-6 rounded-full border border-border"
                  />
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#387F39" />
        <Text className="text-muted-foreground text-sm mt-3">Loading themes...</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-destructive text-base text-center">{fetchError}</Text>
        <Button variant="outline" onPress={loadPool} className="mt-4">
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Generating overlay */}
      <Modal visible={isGenerating} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/60">
          <View className="bg-card rounded-2xl p-8 mx-8 items-center">
            <ActivityIndicator size="large" color="#387F39" />
            <Text className="text-foreground text-lg font-semibold mt-4 text-center">
              AI is architecting your curriculum...
            </Text>
            <Text className="text-muted-foreground text-sm mt-2 text-center">
              This takes 10-20 seconds. Please wait.
            </Text>
          </View>
        </View>
      </Modal>

      <View className="px-4 pt-14 pb-3 flex-row items-end justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Theme Pool</Text>
          <Text className="text-sm text-muted-foreground mt-1">
            Tap a theme to generate a weekly plan
          </Text>
        </View>
        <Button
          size="sm"
          variant="outline"
          loading={refreshing}
          onPress={handleRefresh}
        >
          Refresh
        </Button>
      </View>

      {themePool.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-4xl mb-3">🎨</Text>
          <Text className="text-foreground text-lg font-semibold text-center">
            No themes available
          </Text>
          <Text className="text-muted-foreground text-sm text-center mt-1">
            Tap Refresh to generate new AI themes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={themePool}
          keyExtractor={(item) => item.id}
          renderItem={renderThemeCard}
          contentContainerClassName="px-4 pb-6"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
