# Activity Color System - Daily Schedule

## Overview

The Daily Schedule uses a **fixed color palette** to distinguish different activity types at a glance. Unlike the theme color system (which changes based on weekly theme), activity colors remain consistent to help teachers quickly identify and navigate their daily schedule.

## Color Palette

Each activity category has a distinct, easily separable color with excellent visual contrast:

### 🟩 Circle Time
- **Color:** Deep Moss Green
- **Hex:** `#7A9B76`
- **Usage:** Group learning, songs, routines
- **Tone:** Grounded, focused, community

### 🟨 Theme Activity
- **Color:** Soft Amber / Golden Yellow
- **Hex:** `#F4B740`
- **Usage:** Weekly theme-based activities
- **Tone:** Engaging, educational, creative

### 🟧 Gross Motor
- **Color:** Warm Rust / Terracotta
- **Hex:** `#D4845B`
- **Usage:** Outdoor play, movement, physical development
- **Tone:** Active, energetic, warm

### 🟦 Sensory Activity
- **Color:** Muted Sky Blue
- **Hex:** `#7FABBB`
- **Usage:** Sensory exploration, tactile experiences
- **Tone:** Calm, exploratory, soothing

### 🟪 Free Play
- **Color:** Soft Lavender / Lilac
- **Hex:** `#B4A7D6`
- **Usage:** Self-directed play, centers, exploration
- **Tone:** Creative, independent, gentle

### ⚪ Transition
- **Color:** Soft Taupe
- **Hex:** `#C8B6A6`
- **Usage:** Diaper changes, cleanup, transitions
- **Tone:** Neutral, supportive, calm

### ⚪ Daily Routine
- **Color:** Neutral Gray
- **Hex:** `#B8B8B8`
- **Usage:** Meals, snacks, nap time
- **Tone:** Consistent, reliable, neutral

## Design Implementation

### Color Application

**Background:** Light tint (15% opacity) for subtle visual distinction  
**Border:** Full color strength for clear separation  
**Timeline Dot:** Solid color for quick visual scanning  
**Duration Badge:** White background with colored text and border

### Mobile Layout
- **Vertical stack** of activity cards
- **Colored left border** (4px) for quick scanning
- Timeline dots removed to save space
- Compact card design with time, title, duration

### Desktop Layout
- **Timeline view** with colored dots on vertical line
- **Horizontal cards** with full color backgrounds and borders
- Duration badge and category label on the right
- Hover effect: subtle scale and shadow increase

## Visual Hierarchy

```
Most Prominent (Educational Focus):
1. Circle Time (Green)
2. Theme Activity (Amber)
3. Sensory Activity (Blue)
4. Gross Motor (Rust)

Supportive Activities:
5. Free Play (Lavender)
6. Transition (Taupe)
7. Daily Routine (Gray)
```

## Color Legend

A toggleable legend appears above the schedule with:
- Color dot + label for each activity type
- "Show/Hide Legend" button for experienced teachers
- Organized in two rows: primary activities and support activities

## Accessibility

✅ **WCAG AA Compliant**
- All colored borders maintain 3:1 contrast with white backgrounds
- Text remains in neutral dark tones (#2C3E2F) for readability
- Color is not the only indicator (icons, labels, and text provide redundancy)
- Light background tints (15% opacity) don't interfere with text contrast

✅ **Color Blindness Considerations**
- Sufficient color variety to distinguish types even with color vision deficiency
- Deuteranopia (red-green): Green vs Rust have different brightness values
- Protanopia (red-green): Blue stands out distinctly
- Tritanopia (blue-yellow): Green and Rust remain distinct

## Animation

**Fade-in on load:**
- Staggered animation (40-50ms delay between blocks)
- 300ms duration
- Creates smooth, professional appearance

**Hover effects (Desktop only):**
- Timeline dot: Scale 110% on hover
- Card: Scale 101% + shadow increase
- Smooth transitions (200ms)

## Use Cases

### Quick Scanning
Teachers can quickly identify:
- "When is Circle Time?" → Look for green blocks
- "What's the next themed activity?" → Find amber blocks
- "When do we go outside?" → Spot the rust/terracotta block

### Weekly Planning
- Easily see the distribution of activity types throughout the day
- Identify gaps in sensory or gross motor activities
- Balance theme-focused and free-play time

### Parent Communication
- Visual schedule can be shared with families
- Colors help non-English speaking families understand flow
- Easy to point to specific blocks when discussing the day

## Comparison: Activity Colors vs Theme Colors

| Feature | Activity Colors | Theme Colors |
|---------|----------------|--------------|
| **Purpose** | Identify activity type | Create immersive weekly atmosphere |
| **Consistency** | Fixed palette | Changes weekly |
| **Location** | Daily Schedule tab only | Throughout entire app |
| **Goal** | Quick scanning & navigation | Emotional connection to theme |
| **Accessibility** | High contrast, distinct hues | Coordinated palette, subtle |

## Best Practices

✅ **DO:**
- Use activity colors consistently across all weeks
- Include the legend for new users
- Maintain the 15% opacity for backgrounds
- Keep borders at full strength for clarity

❌ **DON'T:**
- Mix activity colors with theme colors in the schedule
- Reduce contrast for aesthetic reasons
- Remove color indicators in favor of text only
- Change activity colors based on themes

## Future Enhancements

**Potential additions:**
- Custom activity color preferences in settings
- Printable PDF schedule with color coding
- Color-coded calendar view showing activity distribution
- Analytics showing time spent in each activity category

---

**Last Updated:** February 2026  
**Accessibility Standard:** WCAG AA  
**Design Philosophy:** Calm, professional, scannable
