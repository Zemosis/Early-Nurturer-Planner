# Circle Time: Yoga & Music Movement Sections

## Overview

Added two new interactive sections to the Circle Time module: **Yoga & Mindful Movement** and **Music & Movement**. These sections provide teachers with structured, guided activities that promote physical development, mindfulness, and active engagement for mixed-age groups (0-3 years).

---

## 🧘 Yoga Section

### Purpose
Introduce guided movement and mindfulness during Circle Time using yoga poses with visual references and timed interactions.

### Features Implemented (v2.0 — Phase 3 Vector DB Integration)

#### 1. Pose Display
- **Pose Name**: Large, centered display (e.g., "Cat /Cow", "Frog Pose")
- **Pose Image**: Full-width GCS-hosted photo from the yoga PDF catalog
  - `object-contain` sizing — entire illustration always visible
  - Emoji placeholder fallback if no image URL
- **Current Pose Indicator**: "Pose X of Y"

#### 2. How To — Foldable Section
- **Collapsible accordion** with numbered step-by-step instructions
- Purple theme with numbered circle badges (1, 2, 3…)
- Data sourced from `yoga_poses` DB table (extracted from PDF via Gemini)

#### 3. Creative Cues — Foldable Section
- **Collapsible accordion** with kid-friendly creative prompts
- Pink theme with sparkle (✨) bullet points
- E.g., "Try hissssss-ing like an angry cat and moo-ing like a happy cow!"

#### 4. Pose Navigation
- **Previous/Next**: Skip through poses sequentially
- **Random Pose**: Shuffle button for variety
- Foldable sections auto-collapse on pose change

#### 5. Vector DB Integration (Backend)
- Architect generates 2–3 thematic keyword phrases (e.g., "forest animals")
- Enricher embeds theme + keywords via `text-embedding-004`
- Cosine similarity search against `yoga_poses` table returns top 3 poses
- Overwrites `circle_time.yoga_poses` with real pose data (name, image_url, how_to, creative_cues)

### Yoga Poses Catalog (~30 Total in DB)

Poses are sourced from the **"Yoga for the Classroom" PDF** and stored in the `yoga_poses` PostgreSQL table with pgvector embeddings. The enricher picks 3 per plan via semantic search.

Examples:

| Pose | How To (summary) | Creative Cues |
|------|-------------------|---------------|
| **Cat /Cow** | Alternate between angry cat (round back) and cow (lift tail/chest) | "Hissssss like a cat, moo like a cow!" |
| **Frog Pose** | Wide stance, toes out, sit into frog squat | "Hop around like a frog!" |
| **Mountain Pose** | Parallel feet, even weight, reach head to sky | "Stand tall like a mountain top!" |
| **Child's Pose** | Hands and knees, sit back on feet, rest head | "Be strong and steady like a rock!" |

### Design
- **Header**: Purple/pink gradient with yoga emoji (🧘)
- **Card Style**: Clean white with rounded corners (rounded-2xl)
- **Mobile-First**: Full-width on mobile, centered on desktop
- **Touch Targets**: Minimum 44×44px for all buttons
- **Animations**: Smooth transitions between poses (300ms)

---

## 🎵 Music & Movement Section

### Purpose
Encourage active participation through guided music and movement activities with rotating prompts.

### Features Implemented

#### 1. Song Display
- **Auto-Selected Songs**: Curated kid-friendly YouTube videos
- **Song Info**:
  - Title (e.g., "Freeze Dance")
  - Duration (e.g., "3:12")
  - Song counter: "Song X of Y"
- **Embedded Video Player**: Full-width YouTube iframe

#### 2. Movement Prompt Area
- **Dynamic Prompts**: Rotating movement suggestions
- **Rotation Timing**: Every 15 seconds (configurable)
- **Visual Feedback**:
  - Active (playing): Pink gradient with large text
  - Inactive: Muted gray background
- **Progress Indicators**: Dots showing current prompt position
- **Example Prompts**:
  - "Dance and freeze when music stops"
  - "Wiggle your arms up high"
  - "Jump like a bunny"

#### 3. Controls
**Main Playback**:
- **Play/Pause**: Central button (56×56px)
- **Restart Activity**: Reset to first prompt
- **Next Song**: Skip to next song in playlist

**Additional**:
- **3-Second Countdown**: Optional countdown before starting
  - Full-screen overlay with large countdown number
  - "Get Ready!" message
  - Auto-starts activity when countdown ends

#### 4. Movement Preview
- Shows all movement ideas when paused
- Grid layout (1 column mobile, 2 columns desktop)
- Bullet points with orange accents

### Songs Included (4 Total)

| Song | Duration | Movements |
|------|----------|-----------|
| **Freeze Dance** | 3:12 | Dance/freeze, wiggle arms, stomp, spin, jump, march (6 prompts) |
| **Head, Shoulders, Knees and Toes** | 2:01 | Touch body parts, point to eyes/ears/nose (6 prompts) |
| **If You're Happy** | 2:34 | Clap, stomp, shout, pat head, touch toes, hug (6 prompts) |
| **Shake Your Sillies Out** | 3:18 | Shake body, jump, wiggle, nod, stretch, hug (6 prompts) |

### Design
- **Header**: Pink/orange gradient with music emoji (🎵)
- **Card Style**: Clean white with rounded corners
- **Countdown Overlay**: Full-screen modal with blur backdrop
- **Mobile-First**: Optimized for touch interactions
- **Animations**: Smooth prompt transitions (500ms)

---

## 📐 Layout Integration

### New Circle Time Structure

1. **Greeting Song** (Video card)
2. **Goodbye Song** (Video card)
3. **🧘 Yoga & Mindful Movement** ← NEW
4. **🎵 Music & Movement** ← NEW
5. **Daily Circle Time Structure** (Routine items)
6. **Age Adaptations**

### Spacing
- Section headers: `mb-4` (1rem)
- Between sections: `mb-8` (2rem)
- Card padding: `p-4` mobile, `p-6` desktop

---

## 🎨 Design Specifications

### Colors

**Yoga Section**:
- Primary: Purple (`#8B5CF6`)
- Secondary: Pink (`#EC4899`)
- Calm Mode: Blue/Purple gradient
- Warning (last 5s): Orange/Red gradient

**Music & Movement Section**:
- Primary: Pink (`#EC4899`)
- Secondary: Orange (`#F97316`)
- Active state: Pink gradient
- Inactive: Muted gray

### Typography
- **Headers**: `text-base` (mobile), `text-lg` (desktop), font-semibold
- **Pose/Song Names**: `text-xl` (mobile), `text-2xl` (desktop), font-semibold
- **Timer**: `text-5xl` (mobile), `text-6xl` (desktop), font-bold
- **Prompts**: `text-xl` (mobile), `text-2xl` (desktop), font-semibold
- **Body Text**: `text-sm`, leading-relaxed

### Borders & Shadows
- **Cards**: `rounded-2xl`, `shadow-sm`, `border border-border`
- **Buttons**: `rounded-xl`, `shadow-lg` (primary), `shadow-sm` (secondary)
- **Input Elements**: Minimum 44×44px touch targets

---

## 💻 Technical Implementation

### Files Created

**1. `/src/app/components/circle-time/YogaSection.tsx`** (189 lines)
- React component with pose image display and navigation
- Foldable "How To" accordion (numbered steps)
- Foldable "Creative Cues" accordion (sparkle bullets)
- Previous/Next/Random pose controls
- GCS image with `object-contain` sizing

**2. `/src/app/components/circle-time/MusicMovementSection.tsx`** (280 lines)
- React component with song and prompt management
- Movement prompt rotation
- 3-second countdown feature
- Song playlist navigation

### Files Modified

**1. `/src/app/utils/mockData.ts`**
- Updated `yogaPoses` interface: `imageUrl`, `howTo`, `creativeCues` (removed `videoUrl`, `benefits`, `duration`)
- Mock data uses 3 sample poses with GCS image URLs
- Added `musicMovementVideos` array to `circleTime` interface (4 videos)
- Updated `WeekPlan` interface with new types

**2. `/src/app/components/tabs/CircleTimeTab.tsx`**
- Imported YogaSection and MusicMovementSection components
- Added two new section displays with headers
- Integrated with existing Circle Time layout

### State Management

**YogaSection State**:
```typescript
- currentPoseIndex: number
- showHowTo: boolean
- showCues: boolean
```

**MusicMovementSection State**:
```typescript
- currentSongIndex: number
- currentMovementIndex: number
- isPlaying: boolean
- countdown: number
- showCountdown: boolean
```

### Timers
- **Music**: `setInterval` for movement rotation (15000ms)
- **Countdown**: `setInterval` for 3-2-1 countdown (1000ms)
- All timers properly cleaned up in `useEffect` return
- **Yoga**: No timers — static image + instructions display

---

## 📱 Responsive Design

### Mobile (< 1024px)
- **Layout**: Single column, full-width
- **Pose/Song Display**: Full-width video
- **Timer**: Large, centered (text-5xl)
- **Controls**: Stacked buttons with generous spacing
- **Touch Targets**: Minimum 44×44px

### Desktop/Tablet (≥ 1024px)
- **Layout**: Centered content, max-width constraints
- **Pose/Song Display**: Contained aspect-video
- **Timer**: Extra-large (text-6xl)
- **Controls**: Horizontal button layout
- **Hover States**: Subtle transitions on buttons

---

## ♿ Accessibility

### Keyboard Navigation
- All buttons focusable with `tab`
- Clear focus indicators
- Logical tab order

### ARIA Labels
- `aria-label` on icon-only buttons
- Example: `aria-label="Previous pose"`
- `aria-label="Start timer"`

### Screen Readers
- Semantic HTML structure
- Descriptive button text
- Timer updates announced

### Touch Accessibility
- Minimum 44×44px targets (WCAG AAA)
- Generous spacing between buttons
- Clear visual feedback on press

---

## 🎯 User Experience Flow

### Yoga Session Flow

1. **Teacher opens Circle Time tab**
2. **Scrolls to Yoga section**
3. **Reviews current pose** (Tree Pose, benefits shown)
4. **Adjusts duration** if needed (10/15/20/30s buttons)
5. **Chooses mode**:
   - Auto: Continuous flow through all poses
   - Manual: Control each transition
6. **Presses Play** → Timer starts
7. **Timer counts down** (visual feedback, colors change at 5s)
8. **Timer ends** → Audio beep plays
9. **Auto mode**: Transitions to next pose automatically
10. **Manual mode**: Teacher clicks "Next Pose" when ready
11. **Repeat** for all 5 poses

### Music & Movement Session Flow

1. **Teacher opens Circle Time tab**
2. **Scrolls to Music & Movement section**
3. **Reviews song** (e.g., "Freeze Dance")
4. **Previews all movements** (shown when paused)
5. **Optional**: Clicks "Start with 3s Countdown"
   - Full-screen countdown: 3... 2... 1...
   - Auto-starts activity
6. **OR clicks Play** immediately
7. **First prompt displays**: "Dance and freeze when music stops"
8. **Every 15 seconds**: Prompt rotates to next movement
9. **Progress dots** show which prompt is active
10. **Teacher can**:
    - Pause activity
    - Restart from beginning
    - Skip to next song
11. **Repeat** with different songs

---

## 🧪 Testing Checklist

### Yoga Section
- [x] Pose displays correctly (name, video, benefits)
- [x] Timer starts/pauses on button click
- [x] Countdown displays correctly (MM:SS format)
- [x] Duration adjustment buttons work (10/15/20/30s)
- [x] Auto mode transitions to next pose automatically
- [x] Manual mode requires "Next Pose" click
- [x] Previous Pose button works
- [x] Random Pose button selects random pose
- [x] Calm Mode toggles background gradient
- [x] Timer visual feedback changes at 5s remaining
- [x] Audio plays when timer ends
- [x] All buttons have 44×44px minimum touch target
- [x] Responsive on mobile and desktop

### Music & Movement Section
- [x] Song displays correctly (title, video, duration)
- [x] Movement prompts rotate every 15s when playing
- [x] Progress dots update with current prompt
- [x] Play/Pause button works
- [x] Restart button resets to first prompt
- [x] Next Song button switches songs
- [x] 3-Second Countdown displays full-screen
- [x] Countdown auto-starts activity
- [x] All movements preview when paused
- [x] All buttons have 44×44px minimum touch target
- [x] Responsive on mobile and desktop

### Integration
- [x] Both sections display in Circle Time tab
- [x] Sections positioned after Greeting/Goodbye songs
- [x] Headers display with emojis
- [x] Spacing consistent with rest of Circle Time
- [x] Theme colors applied correctly
- [x] No console errors
- [x] Data structure in mockData correct

---

## 📊 Data Structure

### Yoga Pose Interface
```typescript
interface YogaPose {
  id: string;             // Unique identifier ("yoga-0")
  name: string;           // Display name ("Cat /Cow")
  imageUrl?: string;      // GCS public URL to pose photo
  howTo?: string[];       // Step-by-step instructions
  creativeCues?: string[];// Kid-friendly creative prompts
}
```

### Music Movement Song Interface
```typescript
interface MusicMovementSong {
  id: string;           // Unique identifier
  title: string;        // Song title ("Freeze Dance")
  videoUrl: string;     // YouTube embed URL (required)
  duration: string;     // Display format ("3:12")
  movements: string[];  // Array of movement prompts
}
```

### Circle Time Integration
```typescript
circleTime: {
  // ... existing fields
  yogaPoses: YogaPose[];
  musicMovementSongs: MusicMovementSong[];
}
```

---

## 🚀 Future Enhancements

### Yoga Section
1. **Custom Pose Sequences**
   - Allow teachers to create custom pose flows
   - Save favorite sequences

2. **Breathing Guides**
   - Visual breathing animations
   - "Breathe in" / "Breathe out" cues

3. **Sound Effects**
   - Nature sounds during poses
   - Calming music background

4. **Pose Library**
   - Expandable database of 20+ poses
   - Filter by difficulty/age group

### Music & Movement Section
1. **Custom Playlists**
   - Create themed playlists
   - Shuffle mode

2. **Movement Cards**
   - Printable movement prompt cards
   - Visual icons for non-readers

3. **Activity Tracking**
   - Record which songs used each day
   - Avoid repetition

4. **Theme Integration**
   - Match songs to weekly theme
   - Seasonal song recommendations

---

## 🎉 Impact

### For Teachers

✅ **Ready-to-Use Content**
- No planning needed for yoga/movement
- Curated, age-appropriate activities
- Professional quality videos

✅ **Interactive Control**
- Full control over pacing
- Pause/resume mid-activity
- Adapt to classroom needs

✅ **Classroom Projection Ready**
- Large text for visibility
- Clear videos for group viewing
- Simple, uncluttered interface

### For Children

✅ **Engaging Activities**
- Movement-based learning
- Visual and audio stimulation
- Varied, fun prompts

✅ **Mindfulness Practice**
- Calm, focused yoga time
- Breathing awareness
- Body control development

✅ **Physical Development**
- Gross motor skills (jumping, dancing)
- Balance and coordination (yoga poses)
- Following multi-step directions

---

## 📝 Usage Instructions

### For Teachers

**Starting a Yoga Session**:
1. Navigate to Circle Time tab
2. Scroll to "🧘 Yoga & Mindful Movement"
3. Choose Auto (continuous) or Manual (controlled) mode
4. Adjust timer duration if needed (default 15s)
5. Press large Play button to start
6. Follow along with children
7. Use Previous/Next buttons to navigate poses

**Starting a Music & Movement Session**:
1. Navigate to Circle Time tab
2. Scroll to "🎵 Music & Movement"
3. Review movement prompts (shown when paused)
4. Optional: Use "Start with 3s Countdown" for group readiness
5. Press Play to begin activity
6. Movement prompts rotate every 15 seconds automatically
7. Pause anytime to review or give instructions
8. Use Next Song for variety

**Tips**:
- Enable Calm Mode in Yoga section for quieter times
- Use Random Pose feature for surprise element
- Pause Music & Movement to demonstrate a movement
- Restart Activity to practice same song again

---

## 🎨 Visual Examples

### Yoga Section States

**Normal Timer** (15+ seconds remaining):
```
┌──────────────────────────────────────┐
│  🧘 Yoga Time                 🌟 ✨  │  Purple/Pink header
├──────────────────────────────────────┤
│          Tree Pose                   │  Large pose name
│        Pose 1 of 5                   │  Counter
│                                      │
│  ┌──────────────────────────────┐   │
│  │                              │   │  YouTube video
│  │      [Yoga Video]            │   │  or image
│  │                              │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │    ⏱️ Time Remaining          │   │  Purple gradient
│  │         0:15                  │   │  Large timer
│  └──────────────────────────────┘   │
│                                      │
│  Duration: [10s] [15s] [20s] [30s] │  Quick select
│                                      │
│  Benefits: Improves balance, focus  │  Benefits box
│                                      │
│  Mode: [Manual] [Auto]              │  Mode toggle
│                                      │
│  [◀] [↻] [▶️] [||]                  │  Controls
└──────────────────────────────────────┘
```

**Warning State** (Last 5 seconds):
```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐   │
│  │    ⏱️ Time Remaining          │   │  Orange/Red gradient
│  │         0:04                  │   │  Pulsing animation
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

### Music & Movement Section States

**Playing State**:
```
┌──────────────────────────────────────┐
│  🎵 Music & Movement          3:12   │  Pink/Orange header
├──────────────────────────────────────┤
│     Freeze Dance                     │  Song title
│     Song 1 of 4                      │  Counter
│                                      │
│  ┌──────────────────────��───────┐   │
│  │                              │   │  YouTube video
│  │   [Music Video Playing]      │   │
│  │                              │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │   👋 Move Along!              │   │  Pink gradient
│  │                               │   │  (active state)
│  │  Wiggle your arms up high     │   │  Large prompt
│  │                               │   │
│  │   ● ● ○ ○ ○ ○                │   │  Progress dots
│  │  Prompt 3 of 6                │   │
│  └──────────────────────────────┘   │
│                                      │
│  [↻] [||] [▶]                       │  Controls
│                                      │
│  [⏱️ Start with 3s Countdown]        │  Optional feature
│                                      │
│  🔄 Prompts change every 15 seconds │  Info badge
└──────────────────────────────────────┘
```

**Countdown Overlay**:
```
        Full-Screen Overlay
┌────────────────────────────────────────┐
│                                        │
│           Get Ready!                   │
│                                        │
│              3                         │  Giant number
│                                        │  Pulsing
│                                        │
└────────────────────────────────────────┘
     Black backdrop with blur
```

---

## 🔧 Configuration

### Timer Settings
- Default duration: 15 seconds
- Available options: 10, 15, 20, 30 seconds
- Easily extendable to add more options

### Movement Rotation
- Default: 15 seconds per prompt
- Configurable in `MusicMovementSection` component
- Change `movementDuration` constant

### Countdown Duration
- Default: 3 seconds
- Can be adjusted in countdown function
- Currently hardcoded, easy to parameterize

---

## 📚 Resources Used

### Yoga Videos
- Cosmic Kids Yoga (kid-friendly)
- Age-appropriate demonstrations
- Clear, simple instructions

### Music Videos
- Super Simple Songs
- The Kiboomers
- The Learning Station
- Trusted educational channels

### Design Inspiration
- Montessori principles (calm, focused)
- Modern early childhood education apps
- Classroom projection requirements

---

## ✅ Conclusion

The Yoga and Music & Movement sections transform Circle Time into an **interactive, engaging, and structured** experience. Teachers now have professional-quality tools for:

- **Physical Development**: Gross motor skills, balance, coordination
- **Mindfulness**: Focus, breathing, self-regulation
- **Social-Emotional**: Group participation, following directions
- **Cognitive**: Sequencing, memory, body awareness

**Design Philosophy**:
- ✔ Clean, calming UI
- ✔ Large tap targets (44×44px minimum)
- ✔ Mobile-first, responsive design
- ✔ Classroom projection ready
- ✔ Easy for teachers to control
- ✔ Engaging for children

**Result**: Circle Time now feels complete, interactive, and aligned with best practices in early childhood education. 🎉

---

**Version**: 2.0  
**Last Updated**: March 13, 2026  
**Status**: ✅ Complete (Phase 3 — Vector DB yoga integration)
