import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themeLibrary, ThemeDetail } from '../data/themeData';

/** Neutral fallback theme used before the real plan theme is loaded. */
const NEUTRAL_THEME: ThemeDetail = {
  id: '__neutral__',
  name: 'Loading…',
  emoji: '📋',
  letter: '',
  shape: '',
  mood: '',
  atmosphere: [],
  visualDirection: '',
  palette: {
    primary: 'Gray',
    secondary: 'Gray',
    accent: 'Gray',
    background: 'White',
    hex: { primary: '#6B7280', secondary: '#9CA3AF', accent: '#D1D5DB', background: '#F9FAFB' },
  },
  circleTime: { greetingStyle: '', countingContext: '', letterExamples: [], movementPrompt: '', color: '' },
  activities: [],
  environment: { description: '', visualElements: [], ambiance: '' },
};

interface ThemeContextType {
  currentTheme: ThemeDetail;
  setTheme: (themeId: string) => void;
  setThemeFromDetail: (detail: ThemeDetail) => void;
  previewTheme: (themeId: string | null) => void;
  registerDynamicThemes: (themes: ThemeDetail[]) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Pure hex-color brightness adjustment (no DOM). */
export function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1).toUpperCase();
}

interface ThemeProviderProps {
  children: ReactNode;
  onThemeChange?: (theme: ThemeDetail) => void;
}

export function ThemeProvider({ children, onThemeChange }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeDetail>(NEUTRAL_THEME);
  const [originalTheme, setOriginalTheme] = useState<ThemeDetail>(NEUTRAL_THEME);
  const [dynamicThemes, setDynamicThemes] = useState<ThemeDetail[]>([]);

  const findTheme = (themeId: string): ThemeDetail | undefined =>
    themeLibrary.find(t => t.id === themeId) ?? dynamicThemes.find(t => t.id === themeId);

  const setTheme = (themeId: string) => {
    const theme = findTheme(themeId);
    if (theme) {
      setCurrentTheme(theme);
      setOriginalTheme(theme);
      onThemeChange?.(theme);
    }
  };

  const setThemeFromDetail = (detail: ThemeDetail) => {
    setCurrentTheme(detail);
    setOriginalTheme(detail);
    onThemeChange?.(detail);
  };

  const registerDynamicThemes = (themes: ThemeDetail[]) => {
    setDynamicThemes(themes);
  };

  const previewTheme = (themeId: string | null) => {
    if (themeId === null) {
      onThemeChange?.(originalTheme);
    } else {
      const theme = findTheme(themeId);
      if (theme) {
        onThemeChange?.(theme);
      }
    }
  };

  // Apply initial theme on mount
  useEffect(() => {
    onThemeChange?.(currentTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, setThemeFromDetail, previewTheme, registerDynamicThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
