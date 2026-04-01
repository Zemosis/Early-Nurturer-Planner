import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { WeekPlan } from "../utils/mockData";
import { ThemeDetail } from "../utils/themeData";
import { WeekPlanSummary, ThemePoolItem } from "../utils/api";

interface PlannerContextType {
  currentPlan: WeekPlan | null;
  setCurrentPlan: (plan: WeekPlan | null) => void;
  currentPlanId: string | null;
  setCurrentPlanId: (id: string | null) => void;
  allPlans: WeekPlanSummary[];
  setAllPlans: (plans: WeekPlanSummary[]) => void;
  themePool: ThemePoolItem[];
  setThemePool: (pool: ThemePoolItem[]) => void;
  themeOptions: ThemeDetail[];
  setThemeOptions: (themes: ThemeDetail[]) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<WeekPlan | null>(null);
  const [currentPlanId, _setCurrentPlanId] = useState<string | null>(
    () => {
      try { return localStorage.getItem("currentPlanId"); } catch { return null; }
    }
  );
  const setCurrentPlanId = (id: string | null) => {
    _setCurrentPlanId(id);
    try {
      if (id) localStorage.setItem("currentPlanId", id);
      else localStorage.removeItem("currentPlanId");
    } catch { /* SSR / private browsing */ }
  };
  const [allPlans, setAllPlans] = useState<WeekPlanSummary[]>([]);
  const [themePool, setThemePool] = useState<ThemePoolItem[]>([]);
  const [themeOptions, setThemeOptions] = useState<ThemeDetail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <PlannerContext.Provider
      value={{
        currentPlan,
        setCurrentPlan,
        currentPlanId,
        setCurrentPlanId,
        allPlans,
        setAllPlans,
        themePool,
        setThemePool,
        themeOptions,
        setThemeOptions,
        isGenerating,
        setIsGenerating,
        error,
        setError,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error("usePlanner must be used within a PlannerProvider");
  }
  return context;
}
