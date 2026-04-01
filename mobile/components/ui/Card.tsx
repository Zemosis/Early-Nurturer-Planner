import { View, Text } from "react-native";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <View className={`rounded-xl bg-card border border-border p-4 ${className}`}>
      {children}
    </View>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return (
    <View className={`pb-3 ${className}`}>
      {children}
    </View>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Text className={`text-lg font-semibold text-card-foreground ${className}`}>
      {typeof children === "string" ? children : ""}
    </Text>
  );
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Text className={`text-sm text-muted-foreground ${className}`}>
      {typeof children === "string" ? children : ""}
    </Text>
  );
}

export function CardContent({ children, className = "" }: CardProps) {
  return (
    <View className={`${className}`}>
      {children}
    </View>
  );
}

export function CardFooter({ children, className = "" }: CardProps) {
  return (
    <View className={`flex-row items-center pt-3 ${className}`}>
      {children}
    </View>
  );
}
