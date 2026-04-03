import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  configureApi,
  PlannerProvider,
  ThemeProvider,
  ScheduleProvider,
  type StorageProvider,
} from "shared";

/** Keys we need to preload from AsyncStorage before rendering providers. */
const PRELOAD_KEYS = ["currentPlanId"] as const;

configureApi(process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8000");

/**
 * Builds a synchronous StorageProvider backed by an in-memory Map.
 * Writes are mirrored to AsyncStorage (fire-and-forget).
 */
function createSyncStorage(initial: Map<string, string>): StorageProvider {
  const cache = new Map(initial);
  return {
    getItem(key: string): string | null {
      return cache.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      cache.set(key, value);
      AsyncStorage.setItem(key, value);
    },
    removeItem(key: string): void {
      cache.delete(key);
      AsyncStorage.removeItem(key);
    },
  };
}

export default function RootLayout() {
  const [storageProvider, setStorageProvider] =
    useState<StorageProvider | null>(null);

  useEffect(() => {
    (async () => {
      const entries = await AsyncStorage.multiGet(PRELOAD_KEYS as unknown as string[]);
      const initial = new Map<string, string>();
      for (const [key, value] of entries) {
        if (value !== null) initial.set(key, value);
      }
      setStorageProvider(createSyncStorage(initial));
    })();
  }, []);

  if (!storageProvider) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#387F39" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <PlannerProvider storageProvider={storageProvider}>
        <ThemeProvider>
          <ScheduleProvider>
            <BottomSheetModalProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </BottomSheetModalProvider>
          </ScheduleProvider>
        </ThemeProvider>
      </PlannerProvider>
    </GestureHandlerRootView>
  );
}
