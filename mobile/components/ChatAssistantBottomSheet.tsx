import { forwardRef, useImperativeHandle, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

const SUGGESTIONS = [
  "Make it more sensory",
  "Add fine motor",
  "Simplify for 1-year-olds",
  "Make it more theme-based",
];

export interface ChatAssistantRef {
  open: () => void;
  close: () => void;
}

const ChatAssistantBottomSheet = forwardRef<ChatAssistantRef>((_props, ref) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useImperativeHandle(ref, () => ({
    open: () => setVisible(true),
    close: () => setVisible(false),
  }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => setVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Dismiss backdrop */}
        <Pressable
          className="flex-1"
          onPress={() => setVisible(false)}
        />

        {/* Sheet content */}
        <View className="bg-background rounded-t-3xl border-t border-border" style={{ maxHeight: "70%" }}>
          {/* Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </View>

          <ScrollView className="px-4 pb-4" showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-foreground">
                Curriculum Assistant
              </Text>
              <Pressable onPress={() => setVisible(false)}>
                <Text className="text-muted-foreground text-base">✕</Text>
              </Pressable>
            </View>

            {/* Welcome message */}
            <View className="bg-secondary/30 rounded-2xl p-4 mb-4">
              <Text className="text-sm text-foreground">
                Hello! I can help you modify activities, regenerate specific days,
                simplify content, or add extensions. How can I assist you today?
              </Text>
            </View>

            {/* Quick suggestions */}
            <Text className="text-xs text-muted-foreground mb-2">
              Quick suggestions:
            </Text>
            <View className="gap-2 mb-4">
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => setMessage(suggestion)}
                  className="px-4 py-3 bg-secondary/20 rounded-xl"
                >
                  <Text className="text-sm text-foreground">{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Input area */}
          <View className="flex-row gap-2 px-4 pb-6 pt-2 border-t border-border">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type your request..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 px-4 py-3 bg-card rounded-xl border border-border text-sm text-foreground"
            />
            <Pressable className="p-3 bg-primary rounded-xl items-center justify-center opacity-50">
              <Text className="text-primary-foreground text-sm font-medium">Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

ChatAssistantBottomSheet.displayName = "ChatAssistantBottomSheet";

export default ChatAssistantBottomSheet;
