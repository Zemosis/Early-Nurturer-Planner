import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themeLibrary, ThemeDetail } from '../utils/themeData';

interface ThemeContextType {
  currentTheme: ThemeDetail;
  setTheme: (themeId: string) => void;
  previewTheme: (themeId: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeDetail>(themeLibrary[0]);
  const [originalTheme, setOriginalTheme] = useState<ThemeDetail>(themeLibrary[0]);

  const setTheme = (themeId: string) => {
    const theme = themeLibrary.find(t => t.id === themeId);
    if (theme) {
      setCurrentTheme(theme);
      setOriginalTheme(theme);
      applyThemeColors(theme);
    }
  };

  const previewTheme = (themeId: string | null) => {
    if (themeId === null) {
      // Restore original theme
      applyThemeColors(originalTheme);
    } else {
      const theme = themeLibrary.find(t => t.id === themeId);
      if (theme) {
        applyThemeColors(theme, true); // Preview mode
      }
    }
  };

  const applyThemeColors = (theme: ThemeDetail, isPreview?: boolean) => {
    const root = document.documentElement;
    
    // Apply theme colors as CSS variables
    root.style.setProperty('--theme-primary', theme.palette.hex.primary);
    root.style.setProperty('--theme-secondary', theme.palette.hex.secondary);
    root.style.setProperty('--theme-accent', theme.palette.hex.accent);
    root.style.setProperty('--theme-background', theme.palette.hex.background);
    
    // Create lighter and darker variants for hover states
    root.style.setProperty('--theme-primary-light', theme.palette.hex.primary + '20');
    root.style.setProperty('--theme-primary-dark', adjustBrightness(theme.palette.hex.primary, -10));
    root.style.setProperty('--theme-secondary-light', theme.palette.hex.secondary + '20');
    root.style.setProperty('--theme-accent-light', theme.palette.hex.accent + '20');
    
    // Store theme ID for reference
    root.setAttribute('data-theme', theme.id);
  };

  // Helper function to adjust brightness
  const adjustBrightness = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1).toUpperCase();
  };

  // Apply initial theme on mount
  useEffect(() => {
    applyThemeColors(currentTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, previewTheme }}>
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