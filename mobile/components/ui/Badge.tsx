import { View, Text } from "react-native";
import type { ReactNode } from "react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  outline: "border border-border bg-transparent",
};

const variantTextClasses: Record<BadgeVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  destructive: "text-white",
  outline: "text-foreground",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <View className={`self-start flex-row items-center rounded-full px-2.5 py-0.5 ${variantClasses[variant]} ${className}`}>
      {typeof children === "string" ? (
        <Text className={`text-xs font-medium ${variantTextClasses[variant]}`}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
