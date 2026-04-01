import { View, Text } from "react-native";

export default function ThemesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-primary text-xl font-semibold">Theme Library</Text>
      <Text className="text-muted-foreground text-sm mt-2">Explore and select weekly themes</Text>
    </View>
  );
}
