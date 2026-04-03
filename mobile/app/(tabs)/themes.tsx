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
import { Ionicons } from "@expo/vector-icons";
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedForReplace, setSelectedForReplace] = useState<Set<string>>(new Set());

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

  const enterSelectMode = () => {
    setSelectedForReplace(new Set());
    setSelectMode(true);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedForReplace(new Set());
  };

  const toggleSelection = (id: string) => {
    setSelectedForReplace((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmRefresh = async () => {
    if (selectedForReplace.size === 0) {
      Alert.alert("No themes selected", "Select at least one theme to replace.");
      return;
    }
    setRefreshing(true);
    try {
      const keepIds = themePool
        .filter((t) => !selectedForReplace.has(t.id))
        .map((t) => t.id);
      const response = await refreshThemePool(keepIds);
      setThemePool(response.themes);
      exitSelectMode();
    } catch {
      Alert.alert("Error", "Failed to refresh themes.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectTheme = (item: ThemePoolItem) => {
    if (selectMode) {
      toggleSelection(item.id);
      return;
    }
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
    const isSelected = selectedForReplace.has(item.id);
    return (
      <Pressable onPress={() => handleSelectTheme(item)}>
        <View style={selectMode && isSelected ? { borderWidth: 2, borderColor: "#EF4444", borderRadius: 14, overflow: "hidden" } : undefined}>
          <Card className="mb-3">
            {selectMode && (
              <View style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={isSelected ? "#EF4444" : "#D1D5DB"}
                />
              </View>
            )}
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
        </View>
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

      <View className="px-4 pt-2 pb-3 flex-row items-end justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Theme Pool</Text>
          <Text className="text-sm text-muted-foreground mt-1">
            {selectMode ? "Select themes to replace" : "Tap a theme to generate a weekly plan"}
          </Text>
        </View>
        {!selectMode ? (
          <Button
            size="sm"
            variant="outline"
            onPress={enterSelectMode}
          >
            Refresh
          </Button>
        ) : (
          <Pressable onPress={exitSelectMode}>
            <Text style={{ color: "#9CA3AF", fontSize: 14, fontWeight: "500" }}>Cancel</Text>
          </Pressable>
        )}
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
          contentContainerClassName="px-4 pb-24"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sticky bottom bar in select mode */}
      {selectMode && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#E5E7EB",
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: 28,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: "#6B7280" }}>
            {selectedForReplace.size === 0
              ? "Tap themes to select"
              : `${selectedForReplace.size} theme${selectedForReplace.size > 1 ? "s" : ""} selected`}
          </Text>
          <Pressable
            onPress={handleConfirmRefresh}
            disabled={refreshing || selectedForReplace.size === 0}
            style={{
              backgroundColor: selectedForReplace.size > 0 ? "#387F39" : "#D1D5DB",
              borderRadius: 10,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                {`Replace${selectedForReplace.size > 0 ? ` ${selectedForReplace.size}` : ""} Theme${selectedForReplace.size !== 1 ? "s" : ""}`}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}
