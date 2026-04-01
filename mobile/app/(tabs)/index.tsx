import { View, Text } from "react-native";

export default function DashboardScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-primary text-xl font-semibold">Dashboard</Text>
      <Text className="text-muted-foreground text-sm mt-2">Your weekly plans at a glance</Text>
    </View>
  );
}
