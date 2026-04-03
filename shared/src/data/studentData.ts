import { Student, AgeGroup } from "../types/student";

/**
 * Mock student data for development
 */
export const mockStudents: Student[] = [
  {
    id: "1",
    name: "Emma Martinez",
    birthdate: "2023-03-15",
    age: {
      months: 21,
      group: "12-24m",
    },
    photo: undefined, // Will use initials
    tags: ["12-24m"],
    isActive: true,
    notes: "Loves sensory activities and music. Beginning to use 2-word phrases.",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "2",
    name: "Liam Chen",
    birthdate: "2022-08-22",
    age: {
      months: 30,
      group: "24-36m",
    },
    photo: undefined,
    tags: ["24-36m"],
    isActive: true,
    notes: "Very active and curious. Enjoys circle time and group activities.",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "3",
    name: "Sophia Johnson",
    birthdate: "2023-11-10",
    age: {
      months: 15,
      group: "12-24m",
    },
    photo: undefined,
    tags: ["12-24m", "new student"],
    isActive: true,
    notes: "Recently joined. Adjusting well to routine. Prefers quiet activities.",
    createdAt: "2025-02-01T00:00:00Z",
  },
  {
    id: "4",
    name: "Noah Williams",
    birthdate: "2024-01-05",
    age: {
      months: 13,
      group: "12-24m",
    },
    photo: undefined,
    tags: ["12-24m"],
    isActive: true,
    notes: "Walking independently. Enjoys exploring materials.",
    createdAt: "2025-01-15T00:00:00Z",
  },
];

/**
 * Calculate age in months from birthdate
 */
export function calculateAge(birthdate: string): { months: number; group: AgeGroup } {
  const birth = new Date(birthdate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  
  let group: AgeGroup;
  if (months < 12) {
    group = "0-12m";
  } else if (months < 24) {
    group = "12-24m";
  } else {
    group = "24-36m";
  }
  
  return { months, group };
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get color for age group
 */
export function getAgeGroupColor(group: AgeGroup): { bg: string; text: string; border: string } {
  switch (group) {
    case "0-12m":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
      };
    case "12-24m":
      return {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
      };
    case "24-36m":
      return {
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
      };
  }
}

/**
 * Format age for display
 */
export function formatAge(months: number): string {
  if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  return `${years}y ${remainingMonths}m`;
}
