import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ScheduleProvider } from "./contexts/ScheduleContext";
import { PlannerProvider } from "./contexts/PlannerContext";
import "../styles/theme-transitions.css";

export default function App() {
  return (
    <PlannerProvider>
      <ThemeProvider>
        <ScheduleProvider>
          <RouterProvider router={router} />
        </ScheduleProvider>
      </ThemeProvider>
    </PlannerProvider>
  );
}