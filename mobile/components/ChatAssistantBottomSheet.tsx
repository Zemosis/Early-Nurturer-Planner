import { forwardRef, useImperativeHandle, useCallback, useRef, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
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
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [message, setMessage] = useState("");
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["50%", "95%"], []);

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.present(),
    close: () => bottomSheetRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: "#D1D5DB", width: 40 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#1F2937" }}>
            Curriculum Assistant
          </Text>
          <Pressable onPress={() => bottomSheetRef.current?.dismiss()} hitSlop={8}>
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
      </BottomSheetScrollView>

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
    </BottomSheetModal>
  );
});

ChatAssistantBottomSheet.displayName = "ChatAssistantBottomSheet";

export default ChatAssistantBottomSheet;
