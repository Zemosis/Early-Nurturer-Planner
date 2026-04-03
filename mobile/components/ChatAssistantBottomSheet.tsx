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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();

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
        style={{ flex: 1 }}
      >
        {/* Dimmed backdrop */}
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setVisible(false)}
        />

        {/* Sheet content */}
        <View style={{
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "85%",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 16,
        }}>
          {/* Handle indicator */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" }} />
          </View>

          <ScrollView
            style={{ paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: "#1F2937" }}>
                Curriculum Assistant
              </Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={8}>
                <Text style={{ color: "#9CA3AF", fontSize: 16 }}>✕</Text>
              </Pressable>
            </View>

            {/* Welcome message */}
            <View style={{ backgroundColor: "#F3F4F6", borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, color: "#1F2937", lineHeight: 20 }}>
                Hello! I can help you modify activities, regenerate specific days,
                simplify content, or add extensions. How can I assist you today?
              </Text>
            </View>

            {/* Quick suggestions */}
            <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>
              Quick suggestions:
            </Text>
            <View style={{ gap: 8, marginBottom: 16 }}>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => setMessage(suggestion)}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" }}
                >
                  <Text style={{ fontSize: 14, color: "#1F2937" }}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Input area pinned at bottom */}
          <View style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: "#E5E7EB",
          }}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type your request..."
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", fontSize: 14, color: "#1F2937" }}
            />
            <Pressable style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#387F39", borderRadius: 12, alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

ChatAssistantBottomSheet.displayName = "ChatAssistantBottomSheet";

export default ChatAssistantBottomSheet;
