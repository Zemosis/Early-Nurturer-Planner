import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#EFF6EF",
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0.5,
          borderBottomColor: "#D1D5DB",
        },
        headerTitle: () => (
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#387F39", letterSpacing: 0.4 }}>
            Early Nurturer
          </Text>
        ),
        headerLeft: () => <View style={{ width: 40 }} />,
        headerRight: () => <View style={{ width: 40 }} />,
        headerTitleAlign: "center",
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
