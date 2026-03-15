import { AppState, Chore, Person } from "@/types";

const STORAGE_KEY = "chore-calendar-data";

const DEFAULT_PEOPLE: Person[] = [
  { id: "1", name: "Alex", color: "#6366f1" },
  { id: "2", name: "Jordan", color: "#f43f5e" },
  { id: "3", name: "Sam", color: "#10b981" },
  { id: "4", name: "Taylor", color: "#f59e0b" },
];

const DEFAULT_STATE: AppState = {
  chores: [],
  people: DEFAULT_PEOPLE,
};

export function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as AppState;
    return {
      chores: parsed.chores ?? [],
      people: parsed.people ?? DEFAULT_PEOPLE,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Expand parent chores (and any virtual recurring instances) for the given month.
 * allChores includes both parent chores and stored override chores (with parentId).
 */
export function expandRecurringChores(
  allChores: Chore[],
  year: number,
  month: number
): Chore[] {
  const result: Chore[] = [];
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // Only iterate parent chores (no parentId)
  const parentChores = allChores.filter((c) => !c.parentId);

  for (const chore of parentChores) {
    if (chore.recurrence === "none") {
      const choreDate = new Date(chore.date + "T00:00:00");
      if (choreDate.getFullYear() === year && choreDate.getMonth() === month) {
        result.push(chore);
      }
      continue;
    }

    const startDate = new Date(chore.date + "T00:00:00");
    const endDate = chore.recurrenceEndDate
      ? new Date(chore.recurrenceEndDate + "T00:00:00")
      : new Date(year, month + 1, 0);

    const viewEnd = endDate < monthEnd ? endDate : monthEnd;
    let current = new Date(startDate);

    while (current <= viewEnd) {
      if (current >= monthStart) {
        const dateStr = formatDate(current);
        // Check if there's a stored override for this specific date
        const existingOverride = allChores.find(
          (c) => c.parentId === chore.id && c.date === dateStr
        );
        if (existingOverride) {
          result.push(existingOverride);
        } else {
          result.push({
            ...chore,
            id: `${chore.id}_${dateStr}`,
            date: dateStr,
            completed: false,
            parentId: chore.id,
          });
        }
      }

      if (chore.recurrence === "daily") {
        current = new Date(current.getTime() + 86400000);
      } else if (chore.recurrence === "weekly") {
        current = new Date(current.getTime() + 7 * 86400000);
      } else if (chore.recurrence === "monthly") {
        current = new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          current.getDate()
        );
      }
    }
  }

  return result;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return formatDate(new Date());
}
