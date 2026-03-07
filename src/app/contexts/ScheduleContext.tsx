import { createContext, useContext, useState, ReactNode } from 'react';

export interface ScheduleBlock {
  id: string;
  startTime: string; // "08:00"
  endTime: string; // "08:30"
  title: string;
  description: string;
  category: "circle" | "yoga" | "theme" | "gross-motor" | "sensory" | "free-play" | "transition" | "routine";
  notes?: string;
}

interface ScheduleContextType {
  schedules: Record<string, ScheduleBlock[]>; // weekId -> schedule
  isLocked: boolean;
  autoAdjust: boolean;
  updateBlock: (weekId: string, blockId: string, updates: Partial<ScheduleBlock>) => void;
  addBlock: (weekId: string, block: Omit<ScheduleBlock, 'id'>) => void;
  deleteBlock: (weekId: string, blockId: string) => void;
  reorderBlocks: (weekId: string, fromIndex: number, toIndex: number) => void;
  toggleLock: () => void;
  toggleAutoAdjust: () => void;
  getSchedule: (weekId: string) => ScheduleBlock[];
  initializeSchedule: (weekId: string, blocks: ScheduleBlock[]) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [schedules, setSchedules] = useState<Record<string, ScheduleBlock[]>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [autoAdjust, setAutoAdjust] = useState(false);

  const initializeSchedule = (weekId: string, blocks: ScheduleBlock[]) => {
    setSchedules(prev => ({
      ...prev,
      [weekId]: blocks,
    }));
  };

  const getSchedule = (weekId: string): ScheduleBlock[] => {
    return schedules[weekId] || [];
  };

  const updateBlock = (weekId: string, blockId: string, updates: Partial<ScheduleBlock>) => {
    if (isLocked) return;

    setSchedules(prev => {
      const schedule = prev[weekId] || [];
      const blockIndex = schedule.findIndex(b => b.id === blockId);
      
      if (blockIndex === -1) return prev;

      const updatedSchedule = [...schedule];
      updatedSchedule[blockIndex] = { ...updatedSchedule[blockIndex], ...updates };

      // Auto-adjust subsequent blocks if enabled
      if (autoAdjust && (updates.startTime || updates.endTime)) {
        const block = updatedSchedule[blockIndex];
        const timeDiff = calculateTimeDifference(
          schedule[blockIndex].endTime,
          block.endTime
        );

        // Shift all subsequent blocks
        for (let i = blockIndex + 1; i < updatedSchedule.length; i++) {
          updatedSchedule[i] = {
            ...updatedSchedule[i],
            startTime: addMinutesToTime(updatedSchedule[i].startTime, timeDiff),
            endTime: addMinutesToTime(updatedSchedule[i].endTime, timeDiff),
          };
        }
      }

      // Sort by start time
      return {
        ...prev,
        [weekId]: updatedSchedule.sort((a, b) => 
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        ),
      };
    });
  };

  const addBlock = (weekId: string, block: Omit<ScheduleBlock, 'id'>) => {
    if (isLocked) return;

    const newBlock: ScheduleBlock = {
      ...block,
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setSchedules(prev => {
      const schedule = prev[weekId] || [];
      const newSchedule = [...schedule, newBlock];
      
      // Sort by start time
      return {
        ...prev,
        [weekId]: newSchedule.sort((a, b) => 
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        ),
      };
    });
  };

  const deleteBlock = (weekId: string, blockId: string) => {
    if (isLocked) return;

    setSchedules(prev => ({
      ...prev,
      [weekId]: (prev[weekId] || []).filter(b => b.id !== blockId),
    }));
  };

  const reorderBlocks = (weekId: string, fromIndex: number, toIndex: number) => {
    if (isLocked) return;

    setSchedules(prev => {
      const schedule = [...(prev[weekId] || [])];
      const [removed] = schedule.splice(fromIndex, 1);
      schedule.splice(toIndex, 0, removed);

      return {
        ...prev,
        [weekId]: schedule,
      };
    });
  };

  const toggleLock = () => setIsLocked(prev => !prev);
  const toggleAutoAdjust = () => setAutoAdjust(prev => !prev);

  return (
    <ScheduleContext.Provider
      value={{
        schedules,
        isLocked,
        autoAdjust,
        updateBlock,
        addBlock,
        deleteBlock,
        reorderBlocks,
        toggleLock,
        toggleAutoAdjust,
        getSchedule,
        initializeSchedule,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}

// Helper functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function calculateTimeDifference(oldTime: string, newTime: string): number {
  return timeToMinutes(newTime) - timeToMinutes(oldTime);
}

function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) + minutes;
  return minutesToTime(totalMinutes);
}

export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function calculateDuration(startTime: string, endTime: string): number {
  return Math.abs(calculateTimeDifference(startTime, endTime));
}