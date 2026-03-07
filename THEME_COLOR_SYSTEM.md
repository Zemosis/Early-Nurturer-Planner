# Dynamic Theme Color System

## Overview

The Early Nurturer Planner features a comprehensive dynamic color system that automatically adjusts the UI based on the selected weekly theme. Each theme has its own unique color palette that creates an immersive, emotionally distinct experience while maintaining consistent layout structure and accessibility standards.

## How It Works

### 1. Theme Context (`/src/app/contexts/ThemeContext.tsx`)

The `ThemeProvider` wraps the entire application and manages the current theme state. When a theme is selected:

- CSS custom properties are updated on the document root
- Colors transition smoothly (350ms ease-in-out)
- All themed components automatically reflect the new palette

### 2. CSS Variables

Each theme defines 4 core colors that are injected as CSS variables:

```css
--theme-primary: /* Main accent color (buttons, CTAs) */
--theme-secondary: /* Secondary accent (tags, chips) */
--theme-accent: /* Highlight color (special elements) */
--theme-background: /* Soft background tint */
```

Additional variants are generated:
- `--theme-primary-light`: Transparent version for hover states
- `--theme-primary-dark`: Darker version for hover on solid elements
- `--theme-secondary-light`: Light backgrounds for badges
- `--theme-accent-light`: Subtle highlights

### 3. Theme Application

Themes are automatically applied in:

**WeeklyPlan View**
- Active tab indicators use `--theme-primary`
- Domain badges use `--theme-secondary`
- Activity cards feature themed backgrounds

**Dashboard**
- Current week card displays theme border and background
- Domain tags styled with theme colors

**Calendar View**
- Each week card shows a colored top border
- Theme color dot indicator
- Domain badges match theme palette

**Year Overview**
- Week cards feature theme-colored borders
- Visual theme indicators throughout

### 4. Accessibility

✅ **WCAG AA Compliance**
- All theme colors maintain proper contrast ratios
- Body text remains in neutral dark tones (#2C3E2F)
- Theme colors only affect decorative elements, badges, and CTAs
- White text on colored backgrounds meets 4.5:1 contrast minimum

## Theme Palettes

### 🦊 Fox Forest
- **Primary:** Moss Green (#7A9B76)
- **Secondary:** Warm Brown (#8B6F47)
- **Accent:** Muted Orange (#D4845B)
- **Background:** Soft Cream (#F5F1E8)
- **Mood:** Cozy, woodland, grounded

### 🌧 Gentle Rain
- **Primary:** Pale Sky Blue (#B4D4E1)
- **Secondary:** Soft Slate Gray (#A8B5C0)
- **Accent:** Muted Teal (#7FABBB)
- **Background:** Cream White (#F8F9FA)
- **Mood:** Calm, soothing, meditative

### 🌼 Garden Friends
- **Primary:** Light Sage (#B8C5B4)
- **Secondary:** Butter Yellow (#F4E4A6)
- **Accent:** Soft Pink (#F5C6CB)
- **Background:** Leaf Green (#E8F0E3)
- **Mood:** Warm, nurturing, growing

### 🌲 Woodland Trees
- **Primary:** Forest Green (#3D5941)
- **Secondary:** Deep Brown (#6B4423)
- **Accent:** Pine Needle (#5A7C5E)
- **Background:** Birch Cream (#F2EEE6)
- **Mood:** Grounded, peaceful, strong

### 🌊 Ocean Waves
- **Primary:** Ocean Blue (#5B9AAA)
- **Secondary:** Sandy Beige (#D4C5A9)
- **Accent:** Seafoam Green (#9BC4BC)
- **Background:** Shell White (#F7F5F2)
- **Mood:** Flowing, rhythmic, calming

## Using Theme Colors in Components

### Method 1: Utility Classes (Preferred)

```tsx
<div className="bg-theme-primary text-white theme-transition">
  Primary Button
</div>

<span className="bg-theme-secondary-light text-theme-secondary border border-theme-secondary theme-transition">
  Badge
</span>
```

### Method 2: Inline Styles (For Dynamic Values)

```tsx
<div 
  className="theme-transition"
  style={{ backgroundColor: 'var(--theme-background)' }}
>
  Themed Card
</div>
```

### Important Classes

- `theme-transition`: Adds smooth color transitions (always include this for themed elements)
- `bg-theme-*`: Background color utilities
- `text-theme-*`: Text color utilities
- `border-theme-*`: Border color utilities

## Responsive Behavior

**Mobile:**
- Softer, more breathable color accents
- Smaller colored elements to avoid overwhelming small screens
- Theme colors used subtly in borders and small badges

**Desktop:**
- Slightly stronger accent presence
- Larger themed cards and sections
- More prominent use of background tints

## Transition Animation

All theme color changes feature:
- **Duration:** 350ms
- **Easing:** ease-in-out
- **Properties:** background-color, border-color, color, box-shadow

This creates a calm, professional transition when switching between themes without jarring visual changes.

## Best Practices

✅ **DO:**
- Use theme colors for decorative elements, badges, borders
- Maintain the `theme-transition` class for smooth color shifts
- Test color combinations for accessibility
- Keep body text in neutral colors

❌ **DON'T:**
- Override base typography colors with theme colors
- Use theme colors for critical text (readability issues)
- Create hard-coded color values that bypass the theme system
- Remove transition classes (creates jarring color jumps)

## Adding New Themed Components

1. Import `useTheme` hook if you need to programmatically access theme
2. Add `theme-transition` class to elements that should animate
3. Use CSS variables or utility classes for colors
4. Test in all 5 themes to ensure visual consistency

Example:

```tsx
import { useTheme } from '../contexts/ThemeContext';

export function MyThemedComponent() {
  const { currentTheme } = useTheme();
  
  return (
    <div 
      className="rounded-xl p-4 border-2 theme-transition"
      style={{ 
        backgroundColor: 'var(--theme-background)',
        borderColor: 'var(--theme-primary)'
      }}
    >
      <h3 className="text-foreground">
        Themed Content
      </h3>
      <span 
        className="inline-block px-3 py-1 rounded-full theme-transition"
        style={{
          backgroundColor: 'var(--theme-secondary-light)',
          color: 'var(--theme-secondary)'
        }}
      >
        Badge
      </span>
    </div>
  );
}
```

## Theme Preview Component

The `ThemeColorPreview` component demonstrates how theme colors apply to common UI elements. View it in the Theme Detail pages to see live color application.

---

**Last Updated:** February 2026  
**Accessibility Standard:** WCAG AA  
**Browser Support:** All modern browsers with CSS custom property support
