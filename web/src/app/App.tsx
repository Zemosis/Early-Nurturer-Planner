import { RouterProvider } from "react-router";
import { router } from "./routes";
import {
  configureApi,
  PlannerProvider,
  ThemeProvider,
  ScheduleProvider,
  adjustBrightness,
  StorageProvider,
  ThemeDetail,
} from "shared";
import "../styles/theme-transitions.css";

// Configure API base URL for web
configureApi(import.meta.env.VITE_API_BASE_URL || "");

// localStorage adapter for PlannerProvider
const localStorageProvider: StorageProvider = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

// DOM-based theme applier for ThemeProvider
function applyThemeToDOM(theme: ThemeDetail) {
  const root = document.documentElement;

  root.style.setProperty('--theme-primary', theme.palette.hex.primary);
  root.style.setProperty('--theme-secondary', theme.palette.hex.secondary);
  root.style.setProperty('--theme-accent', theme.palette.hex.accent);
  root.style.setProperty('--theme-background', theme.palette.hex.background);

  root.style.setProperty('--theme-primary-light', theme.palette.hex.primary + '20');
  root.style.setProperty('--theme-primary-dark', adjustBrightness(theme.palette.hex.primary, -10));
  root.style.setProperty('--theme-secondary-light', theme.palette.hex.secondary + '20');
  root.style.setProperty('--theme-accent-light', theme.palette.hex.accent + '20');

  root.setAttribute('data-theme', theme.id);
}

export default function App() {
  return (
    <PlannerProvider storageProvider={localStorageProvider}>
      <ThemeProvider onThemeChange={applyThemeToDOM}>
        <ScheduleProvider>
          <RouterProvider router={router} />
        </ScheduleProvider>
      </ThemeProvider>
    </PlannerProvider>
  );
}
