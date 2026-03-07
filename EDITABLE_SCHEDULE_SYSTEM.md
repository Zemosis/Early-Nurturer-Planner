# Editable Daily Schedule System - Complete Documentation

## Overview

The Early Nurturer Planner now features a **fully customizable Daily Schedule** system that empowers family daycare providers to adapt AI-generated templates to their real-world classroom flow. Caretakers can edit times, rename activities, reorder blocks via drag-and-drop, add custom activities, and delete blocks—all while maintaining a clean, calm interface optimized for mobile and desktop.

---

## Core Features ✅

### 1. **Edit Schedule Blocks**
✅ Edit any activity title, time range, description, and category  
✅ Mobile: Tap edit icon → Bottom sheet modal  
✅ Desktop: Click edit icon → Modal dialog  
✅ Real-time duration calculation  
✅ Color-coded activity type dropdown  

### 2. **Drag-and-Drop Reordering**
✅ Drag activities to reorder (via grip handle icon)  
✅ Smooth visual feedback during drag  
✅ Works seamlessly on desktop  
✅ Mobile: Touch-friendly (native drag support)  

### 3. **Add Custom Activities**
✅ "Add New Activity" button at bottom of schedule  
✅ Full form with title, time range, type, description, notes  
✅ Auto-sorts new activities by start time  
✅ Same bottom sheet design as edit modal  

### 4. **Delete Activities**
✅ Delete button in edit modal  
✅ Confirmation prompt prevents accidents  
✅ Cannot delete if schedule is locked  

### 5. **Lock/Unlock Schedule**
✅ Toggle lock button prevents editing  
✅ Visual indicator (lock icon + red color)  
✅ Disables all edit/delete/drag actions  
✅ Prevents accidental changes  

### 6. **Auto-Adjust Times**
✅ Optional toggle: "Auto-adjust times"  
✅ When enabled: Changing one activity shifts later activities automatically  
✅ When disabled: Full manual control  
✅ Smart time recalculation  

---

## User Interface

### Mobile Design (Primary Experience)

**Schedule Block:**
```
┌─────────────────────────────────────┐
│ ≡  🟩  8:45 AM – 9:00 AM      15m ✏️│
│        Circle Time                  │
│        Morning greeting, letter F   │
└─────────────────────────────────────┘
```

**Components:**
- **Grip Handle (≡)**: Drag to reorder (hidden when locked)
- **Color Dot (🟩)**: Activity category indicator
- **Time Range**: 12-hour format with duration badge
- **Edit Icon (✏️)**: Opens bottom sheet editor (hidden when locked)
- **Title**: Bold, truncates on overflow
- **Description**: Smaller text, single line with truncation

**Bottom Sheet Editor:**
- Slides up from bottom (85% viewport height max)
- Drag handle at top for easy dismissal
- Sections:
  - Activity Title (text input)
  - Start Time / End Time (time pickers)
  - Duration Display (auto-calculated with 12-hour format)
  - Activity Type (dropdown with color preview)
  - Description (2-line textarea)
  - Notes (3-line textarea, optional)
- Actions:
  - Save Changes (primary button)
  - Delete (red outline button, right side)
  - Cancel (secondary button)

### Desktop Design

**Schedule Block:**
- Same layout as mobile but with hover states
- Edit icon appears on hover (opacity: 0 → 1)
- Drag handle visible always (unless locked)
- Larger tap targets (44x44px minimum)

**Modal Dialog:**
- Centered on screen
- Max width: 512px (lg breakpoint)
- Rounded corners (3xl)
- Same form as mobile bottom sheet

### Controls Header

```
┌─────────────────────────────────────────────────────┐
│ Daily Flow • Fully customizable to your needs       │
│                                      [Hide Legend] │
├─────────────────────────────────────────────────────┤
│ [🔓 Unlocked] [✓ Auto-adjust times]  14 activities │
└─────────────────────────────────────────────────────┘
```

**Buttons:**
- **Lock/Unlock**: Toggle editing capabilities
  - Unlocked: White background, gray border
  - Locked: Red background, red border with lock icon
- **Auto-adjust times**: Checkbox toggle with sparkles icon
- **Activity Count**: Right-aligned, shows total blocks

---

## Technical Architecture

### State Management

**ScheduleContext** (`/src/app/contexts/ScheduleContext.tsx`)
```typescript
interface ScheduleContextType {
  schedules: Record<string, ScheduleBlock[]>; // weekId → blocks
  isLocked: boolean;
  autoAdjust: boolean;
  updateBlock: (weekId, blockId, updates) => void;
  addBlock: (weekId, block) => void;
  deleteBlock: (weekId, blockId) => void;
  reorderBlocks: (weekId, fromIndex, toIndex) => void;
  toggleLock: () => void;
  toggleAutoAdjust: () => void;
  getSchedule: (weekId) => ScheduleBlock[];
  initializeSchedule: (weekId, blocks) => void;
}
```

**ScheduleBlock Interface:**
```typescript
interface ScheduleBlock {
  id: string;              // Unique identifier
  startTime: string;       // "08:00" (24-hour)
  endTime: string;         // "08:30" (24-hour)
  title: string;           // Activity name
  description: string;     // Brief description
  category: ActivityCategory;
  notes?: string;          // Optional notes
}
```

**Category Types:**
- `circle` - Circle Time (green)
- `theme` - Theme Activity (yellow/amber)
- `gross-motor` - Gross Motor (rust/terracotta)
- `sensory` - Sensory Activity (sky blue)
- `free-play` - Free Play (lavender)
- `transition` - Transition (taupe)
- `routine` - Daily Routine (gray)

### Components

**1. DailyScheduleTab** (`/src/app/components/tabs/DailyScheduleTab.tsx`)
- Main container component
- Wraps content with DndProvider (react-dnd)
- Manages schedule initialization
- Handles all CRUD operations

**2. DraggableBlock**
- Individual schedule block
- Uses `useDrag` and `useDrop` hooks
- Shows edit button on hover (desktop)
- Grip handle for drag (hidden when locked)
- Visual feedback during drag (opacity + scale)

**3. ScheduleBlockEditor** (`/src/app/components/ScheduleBlockEditor.tsx`)
- Bottom sheet (mobile) / Modal (desktop)
- Full editing form
- Real-time duration calculation
- Save, delete, cancel actions

**4. AddActivityModal** (`/src/app/components/AddActivityModal.tsx`)
- Same design as ScheduleBlockEditor
- Pre-fills reasonable defaults (2:00 PM start)
- Validates title before adding
- Auto-sorts by time on save

### Drag-and-Drop Implementation

**Library**: `react-dnd` + `react-dnd-html5-backend`

**Why react-dnd?**
- Recommended in requirements
- Handles complex drag scenarios
- Works on both desktop and mobile
- Smooth animations and visual feedback

**Drag Flow:**
1. User grabs grip handle (≡)
2. `useDrag` detects drag start
3. Block becomes semi-transparent (opacity: 0.5)
4. `useDrop` on other blocks detects hover
5. Hovered block scales slightly (1.02x)
6. On drop: `reorderBlocks()` updates state
7. Schedule re-renders with new order

**Touch Support:**
- HTML5Backend supports touch events
- Long press activates drag
- Visual feedback same as desktop

---

## Smart Features

### Auto-Adjust Times

**When Enabled:**
- User changes Block 3's end time from 10:00 → 10:15
- System calculates time difference: +15 minutes
- All subsequent blocks shift by +15 minutes:
  - Block 4: 10:00-10:30 → 10:15-10:45
  - Block 5: 10:30-11:00 → 10:45-11:15
  - etc.

**When Disabled:**
- Manual control only
- Overlaps allowed (provider responsible)
- More flexibility for complex schedules

**Implementation:**
```typescript
if (autoAdjust && (updates.startTime || updates.endTime)) {
  const timeDiff = calculateTimeDifference(oldEndTime, newEndTime);
  
  for (let i = blockIndex + 1; i < schedule.length; i++) {
    schedule[i].startTime = addMinutesToTime(schedule[i].startTime, timeDiff);
    schedule[i].endTime = addMinutesToTime(schedule[i].endTime, timeDiff);
  }
}
```

### Lock Schedule

**Purpose:**
- Prevent accidental edits
- Lock finalized schedules before sharing
- Visual confirmation (red lock icon)

**What's Disabled:**
- Edit buttons (hidden)
- Delete actions
- Drag-and-drop
- Add activity button
- Time adjustments

**Visual Changes:**
- Lock button turns red
- Grip handles disappear
- Edit icons hidden
- "Locked" label displayed

---

## Default Schedule Template

**AI-Generated Starting Point:**
```
08:00 - 08:30  Arrival & Free Play         (Free Play)
08:30 - 08:45  Morning Snack               (Routine)
08:45 - 09:00  Circle Time                 (Circle)
09:00 - 09:30  Theme Activity              (Theme)
09:30 - 10:15  Outdoor Play                (Gross Motor)
10:15 - 10:30  Diaper/Bathroom & Wash      (Transition)
10:30 - 11:00  Lunch                       (Routine)
11:00 - 12:30  Quiet Time / Nap            (Routine)
12:30 - 12:45  Wake & Transition           (Transition)
12:45 - 13:00  Afternoon Snack             (Routine)
13:00 - 13:30  Sensory Exploration         (Sensory)
13:30 - 14:30  Free Play & Centers         (Free Play)
14:30 - 14:40  Closing Circle              (Circle)
14:40 - 15:00  Departure & Family Updates  (Transition)
```

**Total**: 14 activities, 7 hours (8 AM – 3 PM)

**Theme Integration:**
- Circle Time references week's greeting song, letter, color
- Theme Activity uses activity title from weekly plan
- Sensory Exploration uses sensory activity from plan

---

## Helper Functions

### Time Utilities

**`formatTime12Hour(time: string): string`**
```typescript
"08:00" → "8:00 AM"
"14:30" → "2:30 PM"
"00:00" → "12:00 AM"
```

**`calculateDuration(start: string, end: string): number`**
```typescript
("08:00", "08:30") → 30  // minutes
("09:00", "11:30") → 150 // minutes
```

**`timeToMinutes(time: string): number`**
```typescript
"08:30" → 510  // (8 * 60) + 30
"14:00" → 840  // (14 * 60)
```

**`minutesToTime(minutes: number): string`**
```typescript
510 → "08:30"
840 → "14:00"
```

**`addMinutesToTime(time: string, minutes: number): string`**
```typescript
("08:00", 30) → "08:30"
("10:45", -15) → "10:30"
```

---

## User Flows

### Edit Activity Flow

**Mobile:**
1. Tap edit icon (✏️) on schedule block
2. Bottom sheet slides up from bottom
3. Edit any field (title, times, category, description, notes)
4. Duration updates automatically as times change
5. Tap "Save Changes" → Bottom sheet closes, schedule updates
6. OR tap "Cancel" → Changes discarded

**Desktop:**
1. Hover over schedule block → Edit icon appears
2. Click edit icon
3. Modal appears centered on screen
4. Edit fields (same as mobile)
5. Click "Save Changes" or "Cancel"

### Add New Activity Flow

1. Scroll to bottom of schedule
2. Click "+ Add New Activity" button (dashed border)
3. Bottom sheet / modal opens
4. Fill in:
   - Activity Title (required)
   - Start Time (default: 2:00 PM)
   - End Time (default: 2:30 PM)
   - Activity Type (default: Daily Routine)
   - Description (optional)
   - Notes (optional)
5. Click "Add Activity"
6. New block appears in schedule, auto-sorted by time

### Reorder Activities Flow

**Desktop:**
1. Hover over schedule block
2. Grab grip handle (≡)
3. Drag up or down
4. Hovered blocks scale slightly
5. Drop at desired position
6. Schedule reorders instantly

**Mobile:**
1. Long press on grip handle
2. Drag to new position
3. Drop to reorder

### Lock/Unlock Flow

1. Click lock/unlock button in header
2. Schedule state changes:
   - **Locked**: Red button, lock icon, editing disabled
   - **Unlocked**: White button, unlock icon, editing enabled
3. All edit controls appear/disappear

---

## PDF Export Integration

**Future Enhancement** (not yet implemented):

Exported weekly plans will include:
- Custom schedule with all edits
- Updated time ranges
- Custom activities
- Original theme activities (if not deleted)
- Notes from each block

**Recommended Format:**
```
DAILY SCHEDULE
Week 1: Fox Forest Theme

8:00 AM – 8:30 AM | Arrival & Free Play (30 min)
Greet children, health check, self-directed exploration

8:30 AM – 8:45 AM | Morning Snack (15 min)
Healthy snack and social time

[... continues for all blocks ...]

Notes: Schedule customized by [Provider Name] on [Date]
```

---

## Accessibility Features

### Keyboard Navigation
✅ Tab through all edit buttons  
✅ Enter/Space to activate buttons  
✅ Escape to close modals  
✅ Focus visible on all interactive elements  

### Screen Reader Support
✅ Activity times announced  
✅ Edit button labeled "Edit [Activity Name]"  
✅ Delete confirmation announced  
✅ Duration changes announced  
✅ Lock state announced  

### Visual Indicators
✅ High contrast borders (3:1 minimum)  
✅ Color not sole indicator (text labels + icons)  
✅ Large tap targets (44x44px minimum)  
✅ Focus rings on interactive elements  

### Motion Preferences
⚠️ Future: Respect `prefers-reduced-motion`  
⚠️ Future: Disable drag animations for sensitive users  

---

## Performance Optimizations

### Rendering
- Only re-render changed blocks
- Drag state isolated to DraggableBlock component
- Context updates batched via React setState

### State Management
- Single source of truth (ScheduleContext)
- Per-week schedule storage (doesn't affect other weeks)
- Efficient array operations (splice vs. recreate)

### Drag-and-Drop
- Native HTML5Backend (hardware accelerated)
- Throttled hover calculations
- Optimistic UI updates (no server delay)

---

## Known Limitations & Future Enhancements

### Current Limitations

**1. Mobile Drag-and-Drop**
- Long press required (not intuitive for all users)
- **Future**: Add up/down arrow buttons for mobile reordering

**2. No Undo/Redo**
- Deletions are permanent (with confirmation)
- **Future**: Undo stack with Ctrl+Z support

**3. No Schedule Templates**
- Each week starts with same default template
- **Future**: Save/load custom templates

**4. No Time Conflict Detection**
- Overlapping times allowed
- **Future**: Visual warnings for overlaps

**5. No Bulk Operations**
- Edit/delete one block at a time
- **Future**: Multi-select with checkbox

### Planned Enhancements

**1. Schedule Templates**
```
[ Save as Template ]
→ "My Typical Monday"
→ "Half-Day Schedule"
→ "Extended Care Schedule"
```

**2. Duplicate Block**
```
[Edit] [Duplicate] [Delete]
→ Creates copy with +30min offset
```

**3. Bulk Time Shift**
```
[Shift All by: ±15min ±30min ±1hr]
→ Move entire schedule earlier/later
```

**4. Visual Timeline**
```
|──8:00──9:00──10:00──11:00──|
   ████░░░░████████░░░░░░░░░
   (Duration bars with overlap warnings)
```

**5. Copy Week Schedule**
```
[Copy from Week 2]
→ Import another week's schedule
```

**6. Export to PDF/Print**
```
[Print Schedule] → Clean printable version
```

---

## Testing Checklist

### Edit Functionality
- [x] Can edit activity title
- [x] Can edit start/end times
- [x] Can change activity category
- [x] Can edit description
- [x] Can add/edit notes
- [x] Duration updates in real-time
- [x] Save button commits changes
- [x] Cancel button discards changes

### Add Functionality
- [x] Add button opens modal
- [x] Form validates required fields
- [x] New activity appears in schedule
- [x] Auto-sorts by start time
- [x] Form resets after adding

### Delete Functionality
- [x] Delete button shows in edit modal
- [x] Confirmation prompt prevents accidents
- [x] Block removed from schedule
- [x] Cannot delete when locked

### Drag-and-Drop
- [x] Blocks draggable by grip handle
- [x] Visual feedback during drag (opacity)
- [x] Hover states show drop target
- [x] Drop updates order
- [x] Cannot drag when locked

### Lock/Unlock
- [x] Lock button toggles state
- [x] Edit buttons hidden when locked
- [x] Drag disabled when locked
- [x] Add button hidden when locked
- [x] Visual indicator (red button)

### Auto-Adjust
- [x] Toggle enables/disables feature
- [x] Changing time shifts later blocks
- [x] Calculates time difference correctly
- [x] Does not affect earlier blocks
- [x] Works when disabled (manual mode)

### Mobile Experience
- [x] Bottom sheet slides smoothly
- [x] Drag handle visible
- [x] Touch-friendly tap targets (44px+)
- [x] Time pickers work on mobile
- [x] Keyboard doesn't obscure form

### Desktop Experience
- [x] Modal centered on screen
- [x] Edit icons appear on hover
- [x] Drag-and-drop smooth
- [x] Click to edit inline
- [x] All modals dismissible (Escape)

---

## Code Examples

### Using ScheduleContext

```typescript
import { useSchedule } from '../contexts/ScheduleContext';

function MyComponent() {
  const {
    getSchedule,
    updateBlock,
    addBlock,
    isLocked,
    toggleLock,
  } = useSchedule();

  const weekId = 'week-1';
  const schedule = getSchedule(weekId);

  const handleEdit = (blockId: string) => {
    updateBlock(weekId, blockId, {
      title: 'New Title',
      startTime: '09:00',
    });
  };

  return (
    <div>
      {schedule.map(block => (
        <div key={block.id}>{block.title}</div>
      ))}
    </div>
  );
}
```

### Creating Custom Block

```typescript
const newBlock = {
  startTime: '15:00',
  endTime: '15:30',
  title: 'Art Exploration',
  description: 'Painting with natural materials',
  category: 'theme' as const,
  notes: 'Need smocks and newspaper',
};

addBlock('week-1', newBlock);
```

### Time Calculations

```typescript
import { formatTime12Hour, calculateDuration } from '../contexts/ScheduleContext';

const start = '08:00';
const end = '08:30';

formatTime12Hour(start);  // "8:00 AM"
calculateDuration(start, end);  // 30 (minutes)
```

---

## Design Principles

### 1. **Provider-First Design**
- Flexibility over rigidity
- AI suggests, provider decides
- No locked-in templates

### 2. **Calm Interface**
- Minimal visual clutter
- Subtle hover states
- Large touch targets
- Breathing room between blocks

### 3. **Mobile-First**
- Bottom sheets (not center modals)
- Thumb-friendly button placement
- Responsive time pickers
- Smooth animations

### 4. **Progressive Disclosure**
- Legend hidden by default
- Edit controls on hover/tap
- Optional notes field
- Auto-adjust as opt-in

### 5. **Feedback & Confidence**
- Real-time duration updates
- Confirmation for destructive actions
- Visual drag feedback
- Clear lock state

---

## FAQs

**Q: Can I have multiple schedules per week?**  
A: Currently one schedule per week. Future: Multiple schedule variants (e.g., Mon-Fri vs. Half-Day).

**Q: What happens if I delete all activities?**  
A: Schedule becomes empty. You can add activities back or reset to default template (future feature).

**Q: Can I copy a schedule to another week?**  
A: Not yet. Planned feature: "Copy from Week X" button.

**Q: Does auto-adjust work backwards?**  
A: No, only forwards. Changing Block 5 shifts Blocks 6, 7, 8... but not Blocks 1-4.

**Q: Can I revert changes?**  
A: Not yet. Planned: Undo/redo with history stack.

**Q: Are schedules saved between sessions?**  
A: Yes, via ScheduleContext state. Future: LocalStorage/Supabase persistence.

**Q: Can I export my custom schedule?**  
A: Not yet. Planned: PDF export with all customizations.

---

## Conclusion

The Editable Daily Schedule system empowers family daycare providers with **full control** over their classroom flow while maintaining the **structure and support** of AI-generated templates. With intuitive drag-and-drop, bottom sheet editing, lock/unlock controls, and auto-adjust times, caretakers can adapt schedules to real-world needs—all within a clean, calm, Montessori-inspired interface optimized for mobile and desktop.

**Key Achievements:**
✅ Fully editable schedule blocks  
✅ Drag-and-drop reordering  
✅ Add custom activities  
✅ Delete activities  
✅ Lock/unlock protection  
✅ Auto-adjust times (optional)  
✅ Mobile-first bottom sheets  
✅ Desktop modal dialogs  
✅ Color-coded categories  
✅ Real-time duration calculations  

**Next Steps:**
- Schedule templates
- Undo/redo
- PDF export
- Conflict detection
- Bulk operations

---

**Last Updated**: February 2026  
**Version**: 1.0  
**Status**: ✅ Fully Functional  
**Designed for**: Family Daycare Providers (0-3 years mixed-age)
