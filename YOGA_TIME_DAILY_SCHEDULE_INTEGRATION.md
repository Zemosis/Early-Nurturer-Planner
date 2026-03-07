# Yoga Time - Daily Schedule Integration

## Overview

Added **Yoga Time** as a dedicated, structured block in the Daily Schedule, allowing teachers/caretakers to clearly see and manage this mindfulness activity as an intentional part of the daily flow. This integration connects the Circle Time Yoga module with daily planning.

---

## 🧘 Feature Summary

### What Was Added

✅ **Dedicated Yoga Time Block** in the daily schedule  
✅ **Soft lavender color scheme** (visually distinct)  
✅ **Editable time slots** (just like other activities)  
✅ **Draggable** for reordering within the schedule  
✅ **Linked description** to Circle Time Yoga module  
✅ **Auto-included** in default generated schedules  

---

## 📐 Implementation Details

### 1. New Schedule Block

**Default Time**: 9:00 AM – 9:15 AM (15 minutes)  
**Position**: Immediately after Circle Time  
**Category**: `yoga` (new category type)

**Block Details**:
```typescript
{
  id: "block-yoga",
  startTime: "09:00",
  endTime: "09:15",
  title: "🧘 Yoga Time",
  description: "Mindful movement and breathing • Linked to Circle Time yoga poses",
  category: "yoga",
}
```

### 2. Visual Differentiation

**Color Palette**: Soft Lavender (calm but noticeable)
- **Background**: `#B4A7D615` (lavender with 15% opacity)
- **Border**: `#9B8FCC` (medium lavender)
- **Dot**: `#9B8FCC` (matching border)
- **Label**: "Yoga Time"

**Distinct From**:
- ❌ Circle Time (green `#7A9B76`)
- ❌ Theme Activity (yellow `#F4B740`)
- ❌ Gross Motor (orange `#D4845B`)
- ❌ Sensory (teal `#7FABBB`)
- ❌ Free Play (pink `#E8A5B8`)

### 3. Editable Time Slot

**Features**:
- Teachers can adjust start/end time
- Follows same timestamp format as other activities (24-hour backend, 12-hour display)
- Auto-adjusts schedule spacing when enabled
- Duration automatically calculated and displayed

**Edit Interface**:
- Click the Yoga Time block when schedule is unlocked
- Edit modal/bottom sheet opens
- Modify time, description, or notes
- Save changes or delete block

### 4. Mobile Layout

**Vertical Schedule Card**:
```
┌──────────────────────────────────┐
│ 🔹 🧘 Yoga Time            15m   │  ← Lavender border-left
│ ⏰ 9:00 AM – 9:15 AM            │
│ Mindful movement and breathing  │  ← Description
│ Linked to Circle Time poses     │
└──────────────────────────────────┘
```

**Elements**:
- Lavender left border (4px)
- Yoga emoji in title: "🧘 Yoga Time"
- Clear timestamp display
- 44px minimum tap height
- Edit button appears on hover/press
- Drag handle visible when unlocked

### 5. Desktop Layout

**Grid Layout**:
- Appears in daily schedule list
- Consistent sizing with other blocks
- Color separation maintained
- Clean alignment

**Hover State**:
- Edit button fades in (opacity 0 → 100)
- Background subtle highlight
- Cursor changes to pointer

### 6. Drag & Drop Reordering

**Interaction**:
- When schedule is unlocked
- Drag by grip handle icon
- Visual feedback during drag (opacity 50%)
- Hover indicator on drop target (scale 102%)
- Auto-sorts by time after drop

---

## 🎨 Design Specifications

### Color System

**Yoga Time Colors**:
```css
{
  bg: "#B4A7D615",        /* Soft lavender with transparency */
  border: "#9B8FCC",      /* Medium lavender */
  dot: "#9B8FCC",         /* Color indicator dot */
  label: "Yoga Time"
}
```

**Why Lavender?**
- Calming, associated with mindfulness
- Distinct from existing colors
- Accessible contrast ratio
- Gender-neutral, professional

### Typography

**Title**: "🧘 Yoga Time"
- Font: Medium weight
- Size: Base (16px)
- Color: Foreground (dark)
- Emoji: 🧘 (yoga pose)

**Timestamp**:
- Font: Medium weight
- Size: Extra small (12px)
- Color: Muted foreground
- Format: "9:00 AM – 9:15 AM"

**Duration Badge**:
- Background: White
- Text color: Lavender border color
- Size: Extra small (12px)
- Format: "15m"

**Description**:
- Font: Regular weight
- Size: Small (14px)
- Color: Muted foreground
- Truncated with ellipsis

### Spacing & Layout

**Card Padding**: 16px (1rem)  
**Border Radius**: 12px (rounded-xl)  
**Border Left Width**: 4px  
**Gap Between Elements**: 8px (0.5rem)  
**Minimum Touch Target**: 44px (WCAG AAA)  

---

## 💻 Technical Implementation

### Files Modified

**1. `/src/app/contexts/ScheduleContext.tsx`**
- Added `"yoga"` to `ScheduleBlock` category union type
- Updated type: `category: "circle" | "yoga" | "theme" | ...`

**2. `/src/app/components/tabs/DailyScheduleTab.tsx`**
- Added `yoga` to `categoryColors` object
- Inserted Yoga Time block in `getDefaultSchedule()` function
- Position: After Circle Time (index 3), before Theme Activity
- Adjusted subsequent times to accommodate 15-minute yoga block

**3. `/src/app/components/AddActivityModal.tsx`**
- Added Yoga Time option to `categoryOptions` array
- Teachers can now manually add Yoga Time blocks

**4. `/src/app/components/ScheduleBlockEditor.tsx`**
- Added Yoga Time option to `categoryOptions` array
- Enables editing category to/from Yoga Time

### Updated Schedule Flow

**Before** (without Yoga):
```
08:45 – 09:00  Circle Time
09:00 – 09:30  Theme Activity
09:30 – 10:15  Outdoor Play
```

**After** (with Yoga):
```
08:45 – 09:00  Circle Time         (15 min)
09:00 – 09:15  🧘 Yoga Time        (15 min) ← NEW
09:15 – 09:45  Theme Activity      (30 min)
09:45 – 10:30  Outdoor Play        (45 min)
10:30 – 10:45  Diaper/Bathroom     (15 min)
```

### Code Structure

**Category Type**:
```typescript
category: "circle" | "yoga" | "theme" | "gross-motor" | 
          "sensory" | "free-play" | "transition" | "routine"
```

**Color Definition**:
```typescript
yoga: {
  bg: "#B4A7D615",
  border: "#9B8FCC",
  dot: "#9B8FCC",
  label: "Yoga Time",
}
```

**Default Block**:
```typescript
{
  id: "block-yoga",
  startTime: "09:00",
  endTime: "09:15",
  title: "🧘 Yoga Time",
  description: "Mindful movement and breathing • Linked to Circle Time yoga poses",
  category: "yoga",
}
```

---

## 📱 Responsive Behavior

### Mobile (< 1024px)

**Vertical Stacking**:
- Full-width cards
- Yoga Time appears in sequence
- Drag to reorder by long-press
- Edit button prominent on tap
- Clear visual separation via lavender border

**Card Layout**:
```
┌────────────────────────────────────┐
│ ⋮⋮ 🔹 🧘 Yoga Time           15m  │  ← Grip, dot, title, duration
│    ⏰ 9:00 AM – 9:15 AM           │  ← Timestamp
│    Mindful movement • Linked      │  ← Description
│    to Circle Time poses            │
│                             [✏️]   │  ← Edit icon (when unlocked)
└────────────────────────────────────┘
```

### Desktop/Tablet (≥ 1024px)

**List View**:
- Yoga Time in schedule list
- Hover reveals edit button
- Drag handle always visible (when unlocked)
- Wider layout utilizes horizontal space

**Hover Interaction**:
- Edit button fades in smoothly
- Background subtle highlight
- Cursor: pointer on entire card
- Drag handle: grab cursor

---

## 🔄 Interaction Behavior

### When Clicking Yoga Time

**Unlocked State**:
1. Click anywhere on the Yoga Time card
2. Edit modal/bottom sheet opens
3. Shows editable fields:
   - Title
   - Start Time
   - End Time
   - Category (dropdown)
   - Description
   - Notes (optional)
4. Can modify any field
5. Save changes OR delete block

**Locked State**:
- Click does nothing
- Visual indicator: no edit button
- Prevents accidental changes

### Future Enhancement: Link to Circle Time

**Planned Feature**:
- Click "Linked to Circle Time poses" in description
- Opens Circle Time tab
- Scrolls to Yoga section
- Allows quick access to pose library

---

## 🎯 Use Cases

### For Teachers/Caretakers

**Daily Planning**:
1. Open Daily Schedule tab
2. See Yoga Time clearly positioned after Circle Time
3. Note 15-minute duration
4. Plan materials (mats, calm space)
5. Know it's linked to Circle Time poses

**Adjusting Time**:
1. Unlock schedule
2. Click Yoga Time block
3. Change start time (e.g., 10:30 AM)
4. Change duration (e.g., 20 minutes)
5. Save changes
6. Optional: Enable auto-adjust to shift subsequent activities

**Reordering Activities**:
1. Unlock schedule
2. Drag Yoga Time by grip handle
3. Move to preferred position (e.g., after nap)
4. Drop in new location
5. Schedule auto-sorts by time

**Removing Yoga Time**:
1. Unlock schedule
2. Click Yoga Time block
3. Click delete button (trash icon)
4. Confirm deletion
5. Block removed from schedule

**Adding Yoga Time**:
1. Unlock schedule
2. Click "Add New Activity" button
3. Fill form:
   - Title: "Afternoon Yoga"
   - Time: 2:00 PM – 2:15 PM
   - Category: Yoga Time
   - Description: Custom description
4. Save
5. Block appears in schedule, sorted by time

---

## ✅ Benefits

### For Curriculum Planning

✅ **Intentional Placement**
- Yoga Time is visible in daily flow
- Not hidden in Circle Time tab
- Easy to see time allocation

✅ **Flexibility**
- Can be moved to any time of day
- Duration adjustable (10-30 minutes typical)
- Can have multiple yoga sessions per day

✅ **Integration**
- Links to Circle Time yoga poses
- Cohesive with overall curriculum
- Part of structured daily routine

### For Classroom Implementation

✅ **Clear Scheduling**
- Teachers know exactly when yoga happens
- Can prepare space and materials
- Children see consistent routine

✅ **Time Management**
- 15-minute default (appropriate for 0-3 years)
- Visible duration helps pacing
- Auto-adjust feature maintains flow

✅ **Professional Quality**
- Demonstrates mindfulness practice
- Shows balanced curriculum
- Meets licensing/accreditation standards

---

## 🧪 Testing Checklist

### Display
- [x] Yoga Time block appears in default schedule
- [x] Lavender color scheme applied correctly
- [x] Border, background, and dot colors match
- [x] Emoji "🧘" displays in title
- [x] Description shows correct text
- [x] Duration badge shows "15m"
- [x] Timestamp formatted correctly (12-hour)

### Editing
- [x] Click opens edit modal/bottom sheet
- [x] All fields pre-populated with current values
- [x] Can modify start time
- [x] Can modify end time
- [x] Duration auto-updates when times change
- [x] Can change category to/from yoga
- [x] Can edit description
- [x] Can add optional notes
- [x] Save button updates block
- [x] Delete button removes block (with confirmation)

### Drag & Drop
- [x] Grip handle visible when unlocked
- [x] Can drag Yoga Time block
- [x] Visual feedback during drag (opacity 50%)
- [x] Drop targets show hover indicator
- [x] Schedule re-sorts after drop
- [x] Cannot drag when locked

### Responsive
- [x] Mobile: Full-width card
- [x] Mobile: 44px minimum touch height
- [x] Mobile: Long-press to drag
- [x] Desktop: Hover shows edit button
- [x] Desktop: Drag handle cursor changes to grab

### Integration
- [x] Appears in color legend
- [x] Included in activity count
- [x] Works with lock/unlock toggle
- [x] Works with auto-adjust feature
- [x] Persists across page refreshes
- [x] Unique to each week (stored by weekId)

---

## 📊 Data Structure

### ScheduleBlock Interface

```typescript
export interface ScheduleBlock {
  id: string;                    // "block-yoga"
  startTime: string;              // "09:00" (24-hour)
  endTime: string;                // "09:15" (24-hour)
  title: string;                  // "🧘 Yoga Time"
  description: string;            // "Mindful movement..."
  category: "circle" | "yoga" | "theme" | "gross-motor" | 
            "sensory" | "free-play" | "transition" | "routine";
  notes?: string;                 // Optional notes
}
```

### Category Color Config

```typescript
interface CategoryColor {
  bg: string;        // Background color with transparency
  border: string;    // Border and duration badge color
  dot: string;       // Color indicator dot
  label: string;     // Display label in legend
}
```

### Yoga Category Example

```typescript
const yogaCategory = {
  value: 'yoga',
  label: 'Yoga Time',
  color: '#9B8FCC'
};
```

---

## 🚀 Future Enhancements

### 1. Direct Link to Circle Time Yoga

**Feature**:
- Click on Yoga Time block
- See quick action: "Open Yoga Poses"
- Redirects to Circle Time tab, Yoga section
- Allows immediate access to pose library

**Implementation**:
```typescript
const handleOpenYogaPoses = () => {
  navigate('/week/1?tab=circle&section=yoga');
};
```

### 2. Yoga Time Toggle

**Feature**:
- Add toggle in schedule header
- "Include Yoga Time" checkbox
- Automatically adds/removes yoga block
- Adjusts subsequent times accordingly

### 3. Multiple Yoga Sessions

**Feature**:
- Allow adding multiple yoga blocks per day
- E.g., "Morning Yoga" and "Afternoon Calm-Down Yoga"
- Each with different poses/durations
- Custom descriptions per session

### 4. Pose Preview in Schedule

**Feature**:
- Hover/click on Yoga Time block
- See thumbnail preview of selected poses
- Quick reference without leaving schedule
- Links to full pose details

### 5. Auto-Generate with Theme

**Feature**:
- When generating weekly plan
- Automatically includes yoga poses matching theme
- E.g., Fox Forest theme → Animal yoga poses
- Description updates to reflect theme integration

---

## 📝 Usage Instructions

### For Teachers

**Default Behavior**:
- Yoga Time is automatically included in new schedules
- Positioned after Circle Time (9:00 AM – 9:15 AM)
- No action needed to include it

**Adjusting Yoga Time**:
1. Go to Daily Schedule tab
2. Unlock schedule (click lock icon)
3. Click on Yoga Time block
4. Modify time, duration, or description
5. Save changes

**Moving Yoga Time**:
1. Unlock schedule
2. Drag Yoga Time block by grip handle (⋮⋮)
3. Drop at preferred position
4. Schedule auto-sorts by time

**Removing Yoga Time**:
1. Unlock schedule
2. Click Yoga Time block
3. Click delete button (trash icon)
4. Confirm deletion

**Adding Extra Yoga Session**:
1. Unlock schedule
2. Click "Add New Activity"
3. Title: "Afternoon Yoga"
4. Time: 2:00 PM – 2:15 PM
5. Category: Select "Yoga Time"
6. Save

**Linking to Circle Time Poses**:
1. Note description: "Linked to Circle Time yoga poses"
2. Navigate to Circle Time tab
3. Scroll to Yoga section
4. Review available poses
5. Select poses for yoga session

---

## 🎓 Educational Impact

### Developmental Benefits

✅ **Physical Development**
- Gross motor skills (balance, coordination)
- Body awareness and control
- Strength and flexibility

✅ **Emotional Regulation**
- Mindfulness practice
- Calming techniques
- Self-regulation skills

✅ **Cognitive Growth**
- Following multi-step directions
- Memory (pose sequences)
- Focus and concentration

✅ **Social-Emotional Learning**
- Group participation
- Turn-taking during poses
- Calm, centered energy

### Curriculum Alignment

**Best Practices**:
- Daily mindfulness/movement time
- Age-appropriate poses (0-3 years)
- Structured yet flexible routine
- Integration with Circle Time

**Licensing/Accreditation**:
- Demonstrates balanced curriculum
- Shows physical activity planning
- Meets health and wellness standards
- Professional documentation

---

## 📈 Metrics & Tracking

### Schedule Statistics

**Automatically Tracked**:
- Total activities per day
- Total yoga time per week
- Time allocation percentages
- Activity category distribution

**Example Output**:
```
Daily Schedule Summary:
- 15 activities
- 15 minutes Yoga Time (2.5% of day)
- 75 minutes active movement total (12.5%)
- Well-balanced routine ✓
```

### Future Analytics

**Planned Features**:
- Weekly yoga minutes total
- Pose variety tracking
- Child participation rates
- Development progress linked to yoga

---

## ✨ Conclusion

Yoga Time is now **fully integrated** into the Daily Schedule as a dedicated, visually distinct, editable activity block. Teachers can:

✅ **See yoga time** clearly in daily flow  
✅ **Edit timing** and duration as needed  
✅ **Reorder** via drag-and-drop  
✅ **Link** to Circle Time yoga poses  
✅ **Customize** with notes and adaptations  
✅ **Remove or add** yoga sessions flexibly  

**Result**: Yoga Time feels **intentionally placed**, **clearly visible**, **easy to edit**, **connected to Circle Time**, and **structured but flexible** — exactly as requested. 🧘✨

---

**Version**: 1.0  
**Last Updated**: March 2026  
**Status**: ✅ Complete  
**Integration**: Daily Schedule + Circle Time Yoga Module
