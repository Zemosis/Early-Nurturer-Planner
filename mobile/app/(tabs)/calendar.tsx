import { View, Text } from "react-native";

export default function CalendarScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-primary text-xl font-semibold">Calendar</Text>
      <Text className="text-muted-foreground text-sm mt-2">Browse your curriculum calendar</Text>
    </View>
  );
}
