# Color Systems Overview - Early Nurturer Planner

## Two Complementary Color Systems

The Early Nurturer Planner uses **two distinct color systems** that work together to create an intuitive, professional, and emotionally engaging experience:

---

## 1. 🎨 Theme Color System (Dynamic)

**Purpose:** Create an immersive, emotionally distinct weekly atmosphere

**Scope:** Entire application (Dashboard, Calendar, Week View, Tabs)

**Behavior:** Changes based on the selected weekly theme

### How It Works

When a teacher selects or generates a weekly curriculum plan, the entire app adapts to that theme's unique color palette:

- **Primary Accent:** Buttons, CTAs, active states
- **Secondary Accent:** Tags, chips, domain badges
- **Accent Highlight:** Special elements, icons
- **Background Tint:** Soft washes, card backgrounds

### Example: 🦊 Fox Forest Theme
```
Primary:    #7A9B76 (Moss Green)
Secondary:  #8B6F47 (Warm Brown)
Accent:     #D4845B (Muted Orange)
Background: #F5F1E8 (Soft Cream)
```

### Where It Appears

✅ Dashboard current week card  
✅ Calendar week preview tiles  
✅ Weekly Plan header  
✅ Tab indicators  
✅ Domain badges  
✅ Activity cards  
✅ Button accents  
✅ Theme library cards

### Transition

Smooth 350ms fade when switching between themes for a calm, professional feel.

---

## 2. 🗓️ Activity Color System (Fixed)

**Purpose:** Quick visual identification of activity types in daily schedule

**Scope:** Daily Schedule tab only

**Behavior:** Consistent across all themes and weeks

### How It Works

Each activity category has a permanent, distinct color for instant recognition:

| Activity Type | Color | Hex | Visual |
|--------------|-------|-----|--------|
| **Circle Time** | Deep Moss Green | `#7A9B76` | 🟩 |
| **Theme Activity** | Soft Amber | `#F4B740` | 🟨 |
| **Gross Motor** | Warm Rust | `#D4845B` | 🟧 |
| **Sensory** | Sky Blue | `#7FABBB` | 🟦 |
| **Free Play** | Soft Lavender | `#B4A7D6` | 🟪 |
| **Transition** | Soft Taupe | `#C8B6A6` | ⚪ |
| **Daily Routine** | Neutral Gray | `#B8B8B8` | ⚪ |

### Where It Appears

✅ Daily Schedule tab only  
✅ Timeline dots  
✅ Activity card backgrounds  
✅ Border accents  
✅ Color legend

### Why Fixed?

Teachers need to quickly scan their schedule and identify activity types without having to relearn colors each week. Consistency = efficiency.

---

## Why Two Systems?

### Theme Colors = Emotion & Engagement
- Creates weekly immersion
- Supports developmental learning through consistent visual environment
- Makes each theme feel unique and special
- Helps teachers and children mentally "enter" the theme

### Activity Colors = Function & Clarity
- Enables quick schedule scanning
- Helps with time management
- Supports visual learners
- Maintains consistency across all weeks

---

## Visual Separation Strategy

### In the Daily Schedule Tab

**Activity colors (fixed)** are used exclusively for:
- Activity block backgrounds
- Timeline dots
- Border colors
- Duration badges

**Theme colors (dynamic)** are used for:
- Header section background
- Legend toggle button accents
- Subtle decorative elements

This creates clear visual hierarchy and prevents confusion between the two systems.

### In Other Tabs

**Theme colors** dominate for immersive experience:
- Overview tab domain badges
- Circle Time song headers
- Activities tab theme banners
- Materials lists accents

**Activity colors** do not appear outside the Daily Schedule tab.

---

## Accessibility Compliance

### Both Systems Meet WCAG AA Standards

✅ **Color Contrast:** All colored elements maintain 3:1+ contrast  
✅ **Text Readability:** Body text stays in neutral dark (#2C3E2F)  
✅ **Not Color-Only:** Icons, labels, and text provide redundant cues  
✅ **Color Blindness:** Sufficient brightness and hue variation

### Testing Standards

- Deuteranopia (red-green): ✅ Passed
- Protanopia (red-green): ✅ Passed  
- Tritanopia (blue-yellow): ✅ Passed
- Grayscale conversion: ✅ Distinguishable

---

## User Experience Benefits

### For Teachers

**Quick Scanning:** "Where's Circle Time?" → Look for green  
**Theme Immersion:** Feel the weekly atmosphere throughout planning  
**Professional Design:** Calm, cohesive, not chaotic  
**Learning Curve:** Fixed activity colors = no relearning each week

### For Children (Indirect)

**Visual Consistency:** Same activity colors help routine recognition  
**Thematic Environment:** Teachers create more cohesive themed experiences  
**Calm Spaces:** Professional color choices support regulated environment

### For Families

**Shared Schedules:** Can easily identify activity types  
**Visual Communication:** Color helps overcome language barriers  
**Professional Impression:** Thoughtful design builds trust

---

## Design Philosophy

> "Color should guide, not distract. Support, not overwhelm. Engage, not exhaust."

### Principles

1. **Purposeful Color:** Every color has a job
2. **Accessibility First:** Never sacrifice readability for aesthetics
3. **Calm Over Stimulation:** Muted, warm tones over bright, saturated hues
4. **Consistent Structure:** Layout stays the same, colors change
5. **Professional Yet Warm:** Montessori-inspired but modern

---

## Technical Implementation

### Theme Colors
- Managed by React Context (`ThemeContext`)
- Injected as CSS custom properties (`--theme-primary`, etc.)
- Applied via utility classes or inline styles
- Smooth transitions (350ms ease-in-out)

### Activity Colors
- Defined in component as static object
- Applied directly with inline styles
- No theme dependency
- Fade-in animations on render (300ms stagger)

---

## Best Practices

### ✅ DO

- Use theme colors for emotional atmosphere
- Use activity colors for functional identification
- Keep legend visible for new users
- Test all color combinations for accessibility
- Maintain smooth transitions

### ❌ DON'T

- Mix activity colors in non-schedule contexts
- Change activity colors based on themes
- Use color as the only indicator
- Sacrifice contrast for aesthetics
- Create jarring color transitions

---

## Future Considerations

**Potential Additions:**
- Custom color preferences in settings
- Printable schedules with color coding
- Analytics by activity color distribution
- Parent app with matching color systems
- Additional theme palettes based on user feedback

**User Requests to Monitor:**
- Color customization requests
- Accessibility feedback
- Cultural color preferences
- Seasonal palette variations

---

## Quick Reference

| When to Use | Theme Colors | Activity Colors |
|-------------|-------------|-----------------|
| **Context** | App-wide atmosphere | Schedule identification |
| **Changes** | Weekly | Never |
| **Purpose** | Emotional engagement | Functional clarity |
| **Examples** | Dashboard cards, badges | Schedule blocks, timeline |
| **Priority** | Aesthetic cohesion | Quick scanning |

---

**Last Updated:** February 2026  
**Design System Version:** 1.0  
**Accessibility Standard:** WCAG AA  
**Tested Browsers:** Chrome, Safari, Firefox, Edge
