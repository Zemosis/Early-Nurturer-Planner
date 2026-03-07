import { useState, useEffect, useRef } from "react";
import { Clock, Info, Edit2, GripVertical, Lock, Unlock, Plus, Sparkles } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { useSchedule, ScheduleBlock, formatTime12Hour, calculateDuration } from "../../contexts/ScheduleContext";
import { ScheduleBlockEditor } from "../ScheduleBlockEditor";
import { AddActivityModal } from "../AddActivityModal";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface DailyScheduleTabProps {
  week: WeekPlan;
}

// Fixed color palette for activity categories (not theme-dependent)
const categoryColors = {
  circle: {
    bg: "#7A9B7615",
    border: "#7A9B76",
    dot: "#7A9B76",
    label: "Circle Time",
  },
  yoga: {
    bg: "#B4A7D615",
    border: "#9B8FCC",
    dot: "#9B8FCC",
    label: "Yoga Time",
  },
  theme: {
    bg: "#F4B74015",
    border: "#F4B740",
    dot: "#F4B740",
    label: "Theme Activity",
  },
  "gross-motor": {
    bg: "#D4845B15",
    border: "#D4845B",
    dot: "#D4845B",
    label: "Gross Motor",
  },
  sensory: {
    bg: "#7FABBB15",
    border: "#7FABBB",
    dot: "#7FABBB",
    label: "Sensory Activity",
  },
  "free-play": {
    bg: "#E8A5B815",
    border: "#E8A5B8",
    dot: "#E8A5B8",
    label: "Free Play",
  },
  transition: {
    bg: "#C8B6A615",
    border: "#C8B6A6",
    dot: "#C8B6A6",
    label: "Transition",
  },
  routine: {
    bg: "#E8E8E8",
    border: "#B8B8B8",
    dot: "#B8B8B8",
    label: "Daily Routine",
  },
};

// Default schedule template
function getDefaultSchedule(week: WeekPlan): ScheduleBlock[] {
  return [
    {
      id: "block-arrival",
      startTime: "08:00",
      endTime: "08:30",
      title: "Arrival & Free Play",
      description: "Greet children, health check, self-directed exploration",
      category: "free-play",
    },
    {
      id: "block-snack-1",
      startTime: "08:30",
      endTime: "08:45",
      title: "Morning Snack",
      description: "Healthy snack and social time",
      category: "routine",
    },
    {
      id: "block-circle",
      startTime: "08:45",
      endTime: "09:00",
      title: "Circle Time",
      description: `${week.circleTime.greetingSong.title} • Letter ${week.circleTime.letter} • Color ${week.circleTime.color}`,
      category: "circle",
    },
    {
      id: "block-yoga",
      startTime: "09:00",
      endTime: "09:15",
      title: "🧘 Yoga Time",
      description: "Mindful movement and breathing • Linked to Circle Time yoga poses",
      category: "yoga",
    },
    {
      id: "block-theme",
      startTime: "09:15",
      endTime: "09:45",
      title: "Theme Activity",
      description: week.activities[0]?.title || "Themed learning activity",
      category: "theme",
    },
    {
      id: "block-outdoor",
      startTime: "09:45",
      endTime: "10:30",
      title: "Outdoor Play",
      description: "Gross motor development, nature exploration",
      category: "gross-motor",
    },
    {
      id: "block-transition-1",
      startTime: "10:30",
      endTime: "10:45",
      title: "Diaper/Bathroom & Wash",
      description: "Individual care routines",
      category: "transition",
    },
    {
      id: "block-lunch",
      startTime: "10:45",
      endTime: "11:15",
      title: "Lunch",
      description: "Family-style dining, social skills",
      category: "routine",
    },
    {
      id: "block-nap",
      startTime: "11:15",
      endTime: "12:45",
      title: "Quiet Time / Nap",
      description: "Rest, books, or calm activities by age",
      category: "routine",
    },
    {
      id: "block-transition-2",
      startTime: "12:45",
      endTime: "13:00",
      title: "Wake & Transition",
      description: "Gentle wake-up, diaper changes",
      category: "transition",
    },
    {
      id: "block-snack-2",
      startTime: "13:00",
      endTime: "13:15",
      title: "Afternoon Snack",
      description: "Light snack and hydration",
      category: "routine",
    },
    {
      id: "block-sensory",
      startTime: "13:15",
      endTime: "13:45",
      title: "Sensory Exploration",
      description: week.activities[2]?.title || "Sensory-rich themed activity",
      category: "sensory",
    },
    {
      id: "block-freeplay-2",
      startTime: "13:45",
      endTime: "14:45",
      title: "Free Play & Centers",
      description: "Self-directed exploration with theme materials",
      category: "free-play",
    },
    {
      id: "block-closing",
      startTime: "14:45",
      endTime: "14:55",
      title: "Closing Circle",
      description: week.circleTime.goodbyeSong.title,
      category: "circle",
    },
    {
      id: "block-departure",
      startTime: "14:55",
      endTime: "15:00",
      title: "Departure & Family Updates",
      description: "Share daily highlights with families",
      category: "transition",
    },
  ];
}

// Draggable Block Component
interface DraggableBlockProps {
  block: ScheduleBlock;
  index: number;
  onEdit: (block: ScheduleBlock) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  isLocked: boolean;
}

function DraggableBlock({ block, index, onEdit, onMove, isLocked }: DraggableBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = categoryColors[block.category];
  const duration = calculateDuration(block.startTime, block.endTime);

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'schedule-block',
    item: { index },
    canDrag: !isLocked,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'schedule-block',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        onMove(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Combine drag and drop refs
  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`group bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition-all ${
        isDragging ? 'opacity-50' : ''
      } ${isOver ? 'scale-[1.02]' : ''}`}
      style={{
        borderLeftColor: colors.border,
      }}
    >
      <div
        className="p-4"
        style={{
          backgroundColor: colors.bg,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {!isLocked && (
              <button className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-white/50 rounded transition-colors flex-shrink-0">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
              style={{ backgroundColor: colors.dot }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">
                  {formatTime12Hour(block.startTime)} – {formatTime12Hour(block.endTime)}
                </span>
              </div>
              <h3 className="font-medium text-foreground break-words leading-snug">{block.title}</h3>
            </div>
          </div>
          <div className="flex items-start gap-2 flex-shrink-0">
            <span
              className="text-xs px-2 py-1 rounded-lg font-medium whitespace-nowrap"
              style={{
                backgroundColor: "white",
                color: colors.border,
              }}
            >
              {duration}m
            </span>
            {!isLocked && (
              <button
                onClick={() => onEdit(block)}
                className="p-2 bg-white/60 hover:bg-white/90 rounded-full transition-all active:scale-95 flex-shrink-0"
                style={{ minWidth: '36px', minHeight: '36px' }}
                aria-label="Edit activity"
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground pl-7 line-clamp-2 break-words leading-relaxed">{block.description}</p>
      </div>
    </div>
  );
}

function DailyScheduleTabContent({ week }: DailyScheduleTabProps) {
  const weekId = `week-${week.weekNumber}`;
  const {
    getSchedule,
    initializeSchedule,
    updateBlock,
    addBlock,
    deleteBlock,
    reorderBlocks,
    isLocked,
    autoAdjust,
    toggleLock,
    toggleAutoAdjust,
  } = useSchedule();

  const [showLegend, setShowLegend] = useState(true);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize schedule on mount
  useEffect(() => {
    const existingSchedule = getSchedule(weekId);
    if (existingSchedule.length === 0 && !isInitialized) {
      initializeSchedule(weekId, getDefaultSchedule(week));
      setIsInitialized(true);
    }
  }, [weekId, week, getSchedule, initializeSchedule, isInitialized]);

  const schedule = getSchedule(weekId);

  const handleSaveBlock = (updates: Partial<ScheduleBlock>) => {
    if (editingBlock) {
      updateBlock(weekId, editingBlock.id, updates);
    }
  };

  const handleDeleteBlock = () => {
    if (editingBlock) {
      deleteBlock(weekId, editingBlock.id);
    }
  };

  const handleAddBlock = (newBlock: Omit<ScheduleBlock, 'id'>) => {
    addBlock(weekId, newBlock);
  };

  const handleMoveBlock = (fromIndex: number, toIndex: number) => {
    reorderBlocks(weekId, fromIndex, toIndex);
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="rounded-2xl p-4 border space-y-3" style={{ backgroundColor: 'var(--theme-background)', borderColor: 'var(--theme-primary)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">
            <span className="font-medium">Daily Flow</span> • Fully customizable to your needs
          </p>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            {showLegend ? "Hide" : "Show"} Legend
          </button>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
          <button
            onClick={toggleLock}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isLocked
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : 'bg-white border border-border hover:bg-muted/50'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isLocked ? 'Locked' : 'Unlocked'}
          </button>

          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white border border-border cursor-pointer hover:bg-muted/50 transition-all">
            <input
              type="checkbox"
              checked={autoAdjust}
              onChange={toggleAutoAdjust}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            />
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Auto-adjust times</span>
          </label>

          <div className="ml-auto text-xs text-muted-foreground">
            {schedule.length} activities
          </div>
        </div>
      </div>

      {/* Color Legend */}
      {showLegend && (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-5 animate-in fade-in duration-300">
          <p className="text-sm font-medium text-foreground mb-3">Activity Color Key</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(categoryColors)
              .filter(([key]) => key !== "routine" && key !== "transition")
              .map(([key, config]) => (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2"
                    style={{
                      backgroundColor: config.dot,
                      borderColor: config.border,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                </div>
              ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2"
                  style={{
                    backgroundColor: categoryColors.routine.dot,
                    borderColor: categoryColors.routine.border,
                  }}
                />
                <span className="text-xs text-muted-foreground">Daily Routine</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2"
                  style={{
                    backgroundColor: categoryColors.transition.dot,
                    borderColor: categoryColors.transition.border,
                  }}
                />
                <span className="text-xs text-muted-foreground">Transition</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Blocks */}
      <div className="space-y-3">
        {schedule.map((block, index) => (
          <DraggableBlock
            key={block.id}
            block={block}
            index={index}
            onEdit={setEditingBlock}
            onMove={handleMoveBlock}
            isLocked={isLocked}
          />
        ))}
      </div>

      {/* Add Activity Button */}
      {!isLocked && (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-4 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-primary font-medium"
        >
          <Plus className="w-5 h-5" />
          Add New Activity
        </button>
      )}

      {/* Modals */}
      <ScheduleBlockEditor
        block={editingBlock}
        isOpen={!!editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={handleSaveBlock}
        onDelete={handleDeleteBlock}
      />

      <AddActivityModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddBlock}
      />
    </div>
  );
}

export function DailyScheduleTab(props: DailyScheduleTabProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <DailyScheduleTabContent {...props} />
    </DndProvider>
  );
}