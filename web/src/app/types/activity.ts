/**
 * Enhanced Activity Template Structure
 * Designed for licensing-friendly, professional documentation
 */

export interface DevelopmentalObjective {
  domain: string;
  goals: string[];
}

export interface Material {
  item: string;
  quantity?: string;
  prepRequired?: boolean;
  substitute?: string;
}

export interface InstructionStep {
  step: number;
  title: string;
  description: string;
  duration?: string;
}

export interface AgeAdaptation {
  ageGroup: '0-12m' | '12-24m' | '24-36m';
  label: string;
  icon: string;
  duration?: string;
  description: string;
  modifications: string[];
}

export interface DifferentiationStrategy {
  type: 'support' | 'advanced' | 'mixed-age';
  title: string;
  strategies: string[];
}

export interface ObservationPrompt {
  category: string;
  prompts: string[];
}

export interface DetailedActivity {
  // Overview
  id: string;
  day: string;
  title: string;
  timeBlock: string;
  duration: number; // minutes
  domains: string[];
  themeConnection: string;
  
  // Developmental Objectives
  objectives: DevelopmentalObjective[];
  
  // Materials
  materials: Material[];
  printMaterials?: string[]; // URLs or descriptions
  
  // Instructions
  instructions: InstructionStep[];
  
  // Age Adaptations
  adaptations: AgeAdaptation[];
  
  // Differentiation
  differentiation: DifferentiationStrategy[];
  
  // Observation
  observationPrompts: ObservationPrompt[];
  
  // Reflection (teacher notes)
  reflectionPrompts: string[];
  
  // Metadata
  createdDate?: string;
  modifiedDate?: string;
}

export const ageGroupConfig = {
  '0-12m': {
    label: '0–12 months',
    icon: '👶',
    color: '#7FABBB',
    bgColor: '#7FABBB15',
  },
  '12-24m': {
    label: '12–24 months',
    icon: '👣',
    color: '#F4B740',
    bgColor: '#F4B74015',
  },
  '24-36m': {
    label: '24–36 months',
    icon: '🎒',
    color: '#D4845B',
    bgColor: '#D4845B15',
  },
};

export const domainConfig: Record<string, { color: string; icon: string }> = {
  'Sensory': { color: '#7FABBB', icon: '👐' },
  'Gross Motor': { color: '#D4845B', icon: '🏃' },
  'Fine Motor': { color: '#7A9B76', icon: '✋' },
  'Language': { color: '#F4B740', icon: '💬' },
  'Cognitive': { color: '#B4A7D6', icon: '🧠' },
  'Social-Emotional': { color: '#C8B6A6', icon: '❤️' },
};
