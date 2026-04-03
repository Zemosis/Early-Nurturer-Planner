import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ScheduleBlock } from "shared";

const CATEGORIES = [
  { key: "circle", label: "Circle Time", color: "#7A9B76" },
  { key: "yoga", label: "Yoga Time", color: "#9B8FCC" },
  { key: "theme", label: "Theme Activity", color: "#F4B740" },
  { key: "gross-motor", label: "Gross Motor", color: "#D4845B" },
  { key: "sensory", label: "Sensory", color: "#7FABBB" },
  { key: "free-play", label: "Free Play", color: "#E8A5B8" },
  { key: "transition", label: "Transition", color: "#C8B6A6" },
  { key: "routine", label: "Daily Routine", color: "#B8B8B8" },
] as const;

interface ScheduleBlockEditorProps {
  visible: boolean;
  block: ScheduleBlock | null;
  onSave: (block: ScheduleBlock) => void;
  onDelete?: (blockId: string) => void;
  onReorder?: (blockId: string, direction: "up" | "down") => void;
  onClose: () => void;
  themeColor?: string;
}

export function ScheduleBlockEditor({
  visible,
  block,
  onSave,
  onDelete,
  onReorder,
  onClose,
  themeColor = "#387F39",
}: ScheduleBlockEditorProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:30");
  const [category, setCategory] = useState<ScheduleBlock["category"]>("routine");

  useEffect(() => {
    if (block) {
      setTitle(block.title);
      setDescription(block.description);
      setStartTime(block.startTime);
      setEndTime(block.endTime);
      setCategory(block.category);
    } else {
      setTitle("");
      setDescription("");
      setStartTime("08:00");
      setEndTime("08:30");
      setCategory("routine");
    }
  }, [block, visible]);

  const handleSave = () => {
    const saved: ScheduleBlock = {
      id: block?.id || `block-${Date.now()}`,
      title: title.trim() || "Untitled",
      description: description.trim(),
      startTime,
      endTime,
      category,
    };
    onSave(saved);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Dimmed backdrop */}
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={onClose}
        />

        {/* Sheet content */}
        <View style={{
          maxHeight: "85%",
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
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

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1F2937" }}>
              {block ? "Edit Block" : "New Block"}
            </Text>
            <Pressable onPress={handleSave} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: themeColor }}>Save</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Title
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Block title"
              placeholderTextColor="#9CA3AF"
              style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1F2937", marginBottom: 16, borderWidth: 1.5, borderColor: "#D1D5DB", backgroundColor: "#F8F9FA" }}
            />

            {/* Description */}
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What happens during this block?"
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
              style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1F2937", marginBottom: 16, textAlignVertical: "top", minHeight: 72, borderWidth: 1.5, borderColor: "#D1D5DB", backgroundColor: "#F8F9FA" }}
            />

            {/* Time Row */}
            <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Start
                </Text>
                <TextInput
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  placeholderTextColor="#9CA3AF"
                  style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1F2937", borderWidth: 1.5, borderColor: "#D1D5DB", backgroundColor: "#F8F9FA" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  End
                </Text>
                <TextInput
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="08:30"
                  placeholderTextColor="#9CA3AF"
                  style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1F2937", borderWidth: 1.5, borderColor: "#D1D5DB", backgroundColor: "#F8F9FA" }}
                />
              </View>
            </View>

            {/* Category */}
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Category
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key as ScheduleBlock["category"])}
                  style={{
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1.5,
                    borderColor: category === cat.key ? cat.color : "#E5E7EB",
                    backgroundColor: category === cat.key ? cat.color + "15" : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: category === cat.key ? cat.color : "#6B7280" }}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Reorder buttons (only when editing existing block) */}
            {block && onReorder && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Reorder
                </Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable
                    onPress={() => { onReorder(block.id, "up"); onClose(); }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#D1D5DB", backgroundColor: "#F8F9FA" }}
                  >
                    <Ionicons name="arrow-up" size={16} color="#6B7280" />
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#6B7280" }}>Move Up</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { onReorder(block.id, "down"); onClose(); }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#D1D5DB", backgroundColor: "#F8F9FA" }}
                  >
                    <Ionicons name="arrow-down" size={16} color="#6B7280" />
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#6B7280" }}>Move Down</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Delete */}
            {block && onDelete && (
              <Pressable
                onPress={() => { onDelete(block.id); onClose(); }}
                style={{ alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FCA5A5", marginBottom: 24 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#EF4444" }}>Delete Block</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
