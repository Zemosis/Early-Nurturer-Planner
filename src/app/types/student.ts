/**
 * Student Profile and Documentation Types
 */

export type AgeGroup = '0-12m' | '12-24m' | '24-36m';

export interface Student {
  id: string;
  name: string;
  birthdate: string; // ISO date string
  age: {
    months: number;
    group: AgeGroup;
  };
  photo?: string; // URL or base64
  tags?: string[]; // e.g., ['special needs', 'new student']
  isActive: boolean;
  notes?: string; // General student notes
  createdAt: string;
}

export interface StudentObservation {
  id: string;
  studentId: string;
  weekNumber: number;
  domain: string; // Developmental domain
  date: string;
  observation: string;
  checklist?: string[]; // Checked items
}

export interface StudentWeeklyDocumentation {
  id: string;
  studentId: string;
  weekNumber: number;
  weekRange: string; // e.g., "Jan 1 - Jan 5"
  generalNotes: string;
  observations: StudentObservation[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentProgress {
  studentId: string;
  domain: string;
  checklist: {
    item: string;
    completed: boolean;
    date?: string;
  }[];
  notes: string;
}
