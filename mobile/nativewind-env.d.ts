/// <reference types="nativewind/types" />

// Re-declare the className augmentation for the local react-native copy.
// NativeWind's types augment a nested react-native; this ensures our
// workspace-hoisted copy also gets the className prop.
import "react-native";

declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImagePropsBase {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }
  interface SwitchProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
}
