import { useState, type ReactNode } from "react";
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import { Ionicons } from "@expo/vector-icons";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  badge?: string;
  subtitle?: string;
  themeColor?: string;
}

export function CollapsibleSection({
  title,
  icon,
  iconColor = "#387F39",
  children,
  defaultExpanded = false,
  badge,
  subtitle,
  themeColor,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const color = themeColor || iconColor;

  return (
    <View className="bg-card rounded-2xl border border-border overflow-hidden mb-4">
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded(!expanded);
        }}
        className="flex-row items-center justify-between p-4"
        style={{ minHeight: 56 }}
      >
        <View className="flex-row items-center flex-1 mr-3">
          {icon && (
            <Ionicons name={icon} size={18} color={color} style={{ marginRight: 10 }} />
          )}
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">{title}</Text>
            {subtitle && (
              <Text className="text-xs text-muted-foreground mt-0.5">{subtitle}</Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          {badge && (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "20" }}>
              <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{badge}</Text>
            </View>
          )}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#9CA3AF"
          />
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4">
          {children}
        </View>
      )}
    </View>
  );
}
