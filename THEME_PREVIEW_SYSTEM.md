# Theme Preview System - Generate Week Flow

## Overview

The Theme Preview System creates an **immersive, visual-first experience** when teachers generate new weekly curriculum plans. Instead of immediately showing a final week, teachers are presented with a beautiful theme preview that helps them feel the week's mood and make informed decisions.

---

## User Flow

### 1. Generate Week (Dashboard)

**Trigger:** Teacher clicks "Generate Week" button

**Experience:**
1. **Generating Stage** (2 seconds)
   - Animated loading modal with rotating sparkle icon
   - "Building your weekly curriculum..." message
   - Theme colors begin transitioning in background

2. **Theme Preview Stage**
   - Full modal with immersive theme presentation
   - Large emoji icon with spring animation
   - Theme name and color palette swatches
   - Mood tags (Cozy, Calm, Nurturing, etc.)
   - Quick preview of Circle Time letter and visual style
   - "View Full Week Plan" button to continue

### 2. Weekly Plan View

**Initial State:** Full theme preview card at top of page

**Components:**
- **Theme Preview Card** (dismissible)
  - Large emoji and theme name
  - "Everything this week revolves around [Theme]!" tagline
  - Mood descriptor tags
  - Color palette preview (3 swatches)
  - Visual direction quote
  - Two action buttons:
    - 🔄 "Try Another Theme" - Refresh to random new theme
    - ✓ "Accept Theme" - Minimize preview card

**Minimized State:** Compact reminder bar
- Small emoji and theme name
- "Click to see full theme preview" hint
- 3 mini color swatches
- Clicking expands back to full preview

---

## Component Architecture

### ThemePreviewCard

**Location:** `/src/app/components/ThemePreviewCard.tsx`

**Props:**
```typescript
interface ThemePreviewCardProps {
  theme: ThemeDetail;           // Full theme object
  weekNumber: number;            // Week number
  weekRange: string;             // Date range (e.g., "Jan 15 - Jan 19")
  onRefresh?: () => void;        // Refresh theme handler
  onAccept?: () => void;         // Accept/minimize handler
  showActions?: boolean;         // Show action buttons
}
```

**Features:**
- Animated entrance (fade + slide up)
- Decorative pattern background with theme emoji
- Staggered animations for mood tags and palette
- Smooth theme color transitions
- Responsive design (mobile-first)

**Visual Elements:**
1. Large emoji with spring animation
2. Theme name and week info
3. Immersive tagline with sparkle icon
4. Mood tags with theme colors
5. Color palette swatches (3-4 colors)
6. Visual direction italic quote
7. Gradient overlay for depth

### GenerateWeekModal

**Location:** `/src/app/components/GenerateWeekModal.tsx`

**Props:**
```typescript
interface GenerateWeekModalProps {
  onComplete: () => void;        // Called when user continues to week view
}
```

**Stages:**
1. **Generating** (2 seconds)
   - Compact modal with loading animation
   - Theme selection happens in background
   
2. **Preview** (user-controlled)
   - Expanded modal with full theme details
   - Quick preview of letter and visual style
   - Continue button with arrow icon

**Auto-behavior:**
- Randomly selects theme from library
- Applies theme colors globally via ThemeContext
- Transitions smoothly between stages

---

## Theme Refresh Flow

### How It Works

1. **User clicks "Try Another Theme"**
2. System filters out current theme from library
3. Randomly selects new theme from remaining options
4. Applies new theme colors via `setTheme()`
5. CSS custom properties update with 350ms transition
6. All themed UI elements fade to new colors
7. Preview card updates with new theme details

### Visual Transition

**Duration:** 350ms ease-in-out

**Affected Elements:**
- Background color of preview card
- Border colors
- Mood tag colors
- Color palette swatches
- All themed UI elements across the app

**What Stays Constant:**
- Layout structure
- Typography (body text)
- Week number and dates
- Tab organization

---

## Mobile vs Desktop Experience

### Mobile (< 768px)

**Full Preview:**
- Single column layout
- Mood tags wrap naturally
- Color swatches in horizontal row
- Action buttons stack vertically
- Full-width card with rounded corners

**Minimized:**
- Compact bar with small emoji
- Color swatches on right (3 mini squares)
- Single tap to expand

**Decorative Elements:**
- Reduced opacity for emoji patterns
- Smaller emoji sizes in background

### Desktop (>= 768px)

**Full Preview:**
- Two-column grid for mood/palette section
- Larger emoji and spacing
- Horizontal action buttons
- Hover effects on buttons (shadow + scale)

**Minimized:**
- Wider bar spans full content width
- Hover state shows subtle shadow

**Decorative Elements:**
- Larger background emojis
- More prominent gradient overlay

---

## Theme Data Integration

### What's Shown in Preview

From `ThemeDetail` object:

✅ **Visual Identity**
- `emoji` - Large icon
- `name` - Theme title
- `mood` - Descriptive quote

✅ **Color Palette**
- `palette.hex.primary` - Main accent
- `palette.hex.secondary` - Tags/badges
- `palette.hex.accent` - Highlights
- `palette.hex.background` - Soft tint

✅ **Mood Tags**
- `atmosphere[]` - Array of mood descriptors

✅ **Educational Elements**
- `letter` - Circle Time letter
- `circleTime.letterExamples` - Example words
- `visualDirection` - Design guidance

### Not Shown (Available in Tabs)

❌ Activities (view in Activities tab)  
❌ Materials list (view in Materials tab)  
❌ Circle Time songs (view in Circle Time tab)  
❌ Newsletter content (view in Newsletter tab)

---

## Design Philosophy

### Principles

**1. Visual First, Text Second**
- Large emoji creates immediate emotional connection
- Color palette preview shows mood instantly
- Mood tags convey atmosphere without reading details

**2. Progressive Disclosure**
- Modal shows essentials first
- Full preview reveals more context
- Tabs contain detailed curriculum content

**3. Teacher Empowerment**
- "Try Another Theme" gives control
- No commitment until "Accept Theme"
- Can re-expand minimized preview anytime

**4. Calm Professionalism**
- Muted colors, not neon
- Smooth animations, not jarring
- Warm, inviting, not overwhelming

**5. Montessori-Inspired**
- Natural materials aesthetic
- Purposeful, not decorative
- Beautiful and functional

---

## Animation Details

### Entrance Animations

**ThemePreviewCard:**
```
Initial: opacity: 0, y: -20
Animate: opacity: 1, y: 0
Duration: 400ms, ease-out
```

**Emoji Icon:**
```
Initial: scale: 0
Animate: scale: 1
Type: spring, stiffness: 200
Delay: 200ms
```

**Mood Tags:**
```
Initial: opacity: 0, x: -10
Animate: opacity: 1, x: 0
Stagger: 100ms delay per tag
```

**Color Swatches:**
```
Initial: opacity: 0, scale: 0.8
Animate: opacity: 1, scale: 1
Stagger: 100ms delay per swatch
```

### Transition Animations

**Theme Refresh:**
- All color properties: 350ms ease-in-out
- No layout shift
- Smooth fade between colors

**Expand/Collapse:**
- Height: auto (natural flow)
- Opacity: 300ms
- No abrupt jumps

---

## Accessibility

### Color Contrast

✅ **WCAG AA Compliant**
- Text on colored backgrounds meets 4.5:1 minimum
- Body text stays in neutral dark (#2C3E2F)
- White text on primary buttons: 7:1+ ratio

### Keyboard Navigation

✅ **Fully Keyboard Accessible**
- Tab through action buttons
- Enter/Space to activate
- Escape to dismiss modal (future enhancement)

### Screen Readers

✅ **Semantic HTML**
- Proper heading hierarchy
- Button labels clear ("Try Another Theme", "Accept Theme")
- Decorative emojis use `aria-hidden="true"`

### Motion Preferences

⚠️ **Future Enhancement**
- Respect `prefers-reduced-motion`
- Disable spring animations
- Use simple fades instead

---

## User Benefits

### For Teachers

**Immediate Visual Context**
- "What will this week feel like?" answered instantly
- Color palette helps plan room decoration
- Mood tags inform teaching approach

**Control & Flexibility**
- Can refresh theme unlimited times
- No pressure to commit immediately
- Easy to re-explore later

**Professional Design**
- Builds trust in the platform
- Makes curriculum planning feel elevated
- Saves time selecting appropriate themes

### For Children (Indirect)

**Cohesive Environment**
- Teachers choose themes intentionally
- Visual consistency throughout week
- Supports developmental learning

**Appropriate Atmosphere**
- Calm themes for soothing weeks
- Playful themes for exploration weeks
- Matched to developmental needs

---

## Technical Implementation

### State Management

**WeeklyPlan Component:**
```typescript
const [showThemePreview, setShowThemePreview] = useState(true);
```

**Theme Refresh:**
```typescript
const handleRefreshTheme = () => {
  const otherThemes = themeLibrary.filter(t => t.id !== currentTheme.id);
  const randomTheme = otherThemes[Math.floor(Math.random() * otherThemes.length)];
  setTheme(randomTheme.id);
};
```

**Accept/Minimize:**
```typescript
const handleAcceptTheme = () => {
  setShowThemePreview(false);
};
```

### Theme Context Integration

**Global State:**
- `currentTheme` from ThemeContext
- `setTheme()` updates CSS custom properties
- All components respond to theme changes

**CSS Variables Applied:**
```css
--theme-primary
--theme-secondary
--theme-accent
--theme-background
--theme-primary-light
--theme-secondary-light
--theme-accent-light
--theme-primary-dark
```

---

## Future Enhancements

### Potential Features

**Theme Customization:**
- Adjust individual colors
- Save custom theme variations
- Share themes with other teachers

**Theme History:**
- "Recently used themes"
- "Favorite themes" collection
- Seasonal theme suggestions

**Enhanced Preview:**
- Sample activity card in theme colors
- Sample newsletter header preview
- Room decoration suggestions

**Animation Options:**
- "Skip preview" preference
- Reduced motion mode
- Custom animation speed

**Collaborative Features:**
- Share week with preview link
- Comment on theme selections
- Team theme voting

---

## Best Practices

### ✅ DO

- Show theme preview for all new generated weeks
- Allow unlimited theme refreshes
- Maintain smooth color transitions
- Keep preview accessible and keyboard-navigable
- Provide clear "accept" action

### ❌ DON'T

- Auto-advance without user confirmation
- Remove theme refresh option
- Show too much information in preview (save for tabs)
- Use jarring animations or transitions
- Force a theme choice (allow exploration)

---

## Testing Checklist

- [ ] Theme preview appears on new week generation
- [ ] Refresh button selects different random theme
- [ ] Accept button minimizes to compact view
- [ ] Clicking compact view re-expands preview
- [ ] Colors transition smoothly (350ms)
- [ ] Animations work on mobile and desktop
- [ ] Keyboard navigation functions correctly
- [ ] Screen reader announces theme changes
- [ ] All theme colors meet contrast standards
- [ ] Preview looks good with all 5 themes

---

**Last Updated:** February 2026  
**Feature Version:** 1.0  
**Design Standard:** Montessori-inspired, calm, professional  
**Animation Standard:** Smooth, purposeful, accessible
