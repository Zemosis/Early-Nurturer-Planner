import { Pressable, Text, ActivityIndicator } from "react-native";
import type { ReactNode } from "react";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary",
  destructive: "bg-destructive",
  outline: "border border-border bg-transparent",
  secondary: "bg-secondary",
  ghost: "bg-transparent",
};

const variantTextClasses: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  destructive: "text-white",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-5 py-2.5",
  sm: "h-9 px-3 py-2",
  lg: "h-12 px-6 py-3",
};

const sizeTextClasses: Record<ButtonSize, string> = {
  default: "text-sm",
  sm: "text-xs",
  lg: "text-base",
};

export function Button({
  children,
  variant = "default",
  size = "default",
  disabled = false,
  loading = false,
  onPress,
  className = "",
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center rounded-lg ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? "opacity-50" : ""} ${className}`}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "default" ? "#FFFFFF" : "#387F39"}
          className="mr-2"
        />
      )}
      {typeof children === "string" ? (
        <Text className={`font-medium ${variantTextClasses[variant]} ${sizeTextClasses[size]}`}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
