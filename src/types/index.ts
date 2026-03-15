export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface Chore {
  id: string;
  title: string;
  description?: string;
  assigneeId: string | null;
  date: string; // ISO date string YYYY-MM-DD
  completed: boolean;
  recurrence: RecurrenceType;
  recurrenceEndDate?: string; // ISO date string YYYY-MM-DD
  parentId?: string; // for recurring instances
  createdAt: string;
}

export interface AppState {
  chores: Chore[];
  people: Person[];
}

export type ModalMode = "add" | "edit" | "view";

export interface ChoreModalData {
  mode: ModalMode;
  chore?: Chore;
  date?: string;
}
