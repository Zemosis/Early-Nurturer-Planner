import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ScheduleProvider } from "./contexts/ScheduleContext";
import "../styles/theme-transitions.css";

export default function App() {
  return (
    <ThemeProvider>
      <ScheduleProvider>
        <RouterProvider router={router} />
      </ScheduleProvider>
    </ThemeProvider>
  );
}