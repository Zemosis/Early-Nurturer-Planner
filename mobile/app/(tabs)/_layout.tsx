import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#FAF9F6", elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 },
        headerTitle: () => (
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#387F39", letterSpacing: 0.3 }}>
            Early Nurturer
          </Text>
        ),
        tabBarActiveTintColor: "#387F39",
        tabBarInactiveTintColor: "#5C6B5E",
        tabBarStyle: { backgroundColor: "#FAF9F6", borderTopColor: "rgba(0,0,0,0.08)" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="themes"
        options={{
          title: "Themes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="color-palette-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
