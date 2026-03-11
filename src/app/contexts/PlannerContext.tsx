import { createContext, useContext, useState, ReactNode } from "react";
import { WeekPlan } from "../utils/mockData";
import { ThemeDetail } from "../utils/themeData";

interface PlannerContextType {
  currentPlan: WeekPlan | null;
  setCurrentPlan: (plan: WeekPlan | null) => void;
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
  const [themeOptions, setThemeOptions] = useState<ThemeDetail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <PlannerContext.Provider
      value={{
        currentPlan,
        setCurrentPlan,
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
