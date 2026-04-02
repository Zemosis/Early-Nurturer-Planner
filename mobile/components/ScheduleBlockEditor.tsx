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
  onClose: () => void;
  themeColor?: string;
}

export function ScheduleBlockEditor({
  visible,
  block,
  onSave,
  onDelete,
  onClose,
  themeColor = "#387F39",
}: ScheduleBlockEditorProps) {
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
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={onClose}
        />
        <View className="bg-card rounded-t-3xl" style={{ maxHeight: "85%" }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <Pressable onPress={onClose}>
              <Text className="text-sm text-muted-foreground">Cancel</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">
              {block ? "Edit Block" : "New Block"}
            </Text>
            <Pressable onPress={handleSave}>
              <Text className="text-sm font-semibold" style={{ color: themeColor }}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Title
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Block title"
              className="border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-4"
              placeholderTextColor="#9CA3AF"
            />

            {/* Description */}
            <Text className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What happens during this block?"
              multiline
              numberOfLines={3}
              className="border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-4"
              placeholderTextColor="#9CA3AF"
              style={{ textAlignVertical: "top", minHeight: 72 }}
            />

            {/* Time Row */}
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Start
                </Text>
                <TextInput
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  className="border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  End
                </Text>
                <TextInput
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="08:30"
                  className="border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Category */}
            <Text className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Category
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key as ScheduleBlock["category"])}
                  className="rounded-lg px-3 py-2 border"
                  style={{
                    borderColor: category === cat.key ? cat.color : "#E5E7EB",
                    backgroundColor: category === cat.key ? cat.color + "15" : "transparent",
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: category === cat.key ? cat.color : "#6B7280" }}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Delete */}
            {block && onDelete && (
              <Pressable
                onPress={() => {
                  onDelete(block.id);
                  onClose();
                }}
                className="items-center py-3 rounded-xl border border-red-200 mb-6"
              >
                <Text className="text-sm font-medium text-red-500">Delete Block</Text>
              </Pressable>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
