import { createBrowserRouter } from "react-router";
import Dashboard from "./pages/Dashboard";
import CalendarView from "./pages/CalendarView";
import WeeklyPlan from "./pages/WeeklyPlan";
import YearOverview from "./pages/YearOverview";
import { ThemeLibrary } from "./components/ThemeLibrary";
import { ThemeDetail } from "./components/ThemeDetail";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/calendar",
    Component: CalendarView,
  },
  {
    path: "/week/:weekId",
    Component: WeeklyPlan,
  },
  {
    path: "/year",
    Component: YearOverview,
  },
  {
    path: "/themes",
    Component: ThemeLibrary,
  },
  {
    path: "/themes/:themeId",
    Component: ThemeDetail,
  },
]);