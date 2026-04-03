import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["85%", "100%"], []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:30");
  const [category, setCategory] = useState<ScheduleBlock["category"]>("routine");

  useEffect(() => {
    if (visible) {
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
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
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
      onDismiss={onClose}
      backgroundStyle={{
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: "#D1D5DB", width: 40 }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
        <Pressable onPress={() => { bottomSheetRef.current?.dismiss(); }} hitSlop={8}>
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>Cancel</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#1F2937" }}>
          {block ? "Edit Block" : "New Block"}
        </Text>
        <Pressable onPress={handleSave} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: themeColor }}>Save</Text>
        </Pressable>
      </View>

      <BottomSheetScrollView
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

        {/* Delete */}
        {block && onDelete && (
          <Pressable
            onPress={() => { onDelete(block.id); onClose(); }}
            style={{ alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FCA5A5", marginBottom: 24 }}
          >
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#EF4444" }}>Delete Block</Text>
          </Pressable>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
