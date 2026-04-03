"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { AppState, Chore, Person, ChoreModalData } from "@/types";
import {
  loadState,
  saveState,
  generateId,
  expandRecurringChores,
} from "@/lib/storageV2";

interface ChoreContextValue {
  state: AppState;
  currentYear: number;
  currentMonth: number;
  selectedDate: string | null;
  modalData: ChoreModalData | null;

  choresForMonth: Chore[];
  choresForDate: (date: string) => Chore[];
  personById: (id: string) => Person | undefined;

  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;
  setSelectedDate: (date: string | null) => void;

  addChore: (chore: Omit<Chore, "id" | "createdAt">) => void;
  updateChore: (id: string, updates: Partial<Chore>, updateAll?: boolean) => void;
  deleteChore: (id: string, deleteAll?: boolean) => void;
  toggleComplete: (chore: Chore) => void;

  addPerson: (name: string, color: string) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;

  openModal: (data: ChoreModalData) => void;
  closeModal: () => void;
}

const ChoreContext = createContext<ChoreContextValue | null>(null);

/**
 * Parse virtual chore ID: format is "${parentId}_${YYYY-MM-DD}"
 * The date portion is always the last 10 characters.
 */
export function parseVirtualId(
  id: string
): { parentId: string; date: string } | null {
  if (id.length < 12) return null;
  const dateStr = id.slice(-10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parentId = id.slice(0, id.length - 11); // strip "_YYYY-MM-DD"
  return { parentId, date: dateStr };
}

export function ChoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({ chores: [], people: [] });
  const [hydrated, setHydrated] = useState(false);
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalData, setModalData] = useState<ChoreModalData | null>(null);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveState(state);
    }
  }, [state, hydrated]);

  const choresForMonth = useMemo(
    () => expandRecurringChores(state.chores, currentYear, currentMonth),
    [state.chores, currentYear, currentMonth]
  );

  const choresForDate = useCallback(
    (date: string) => choresForMonth.filter((c) => c.date === date),
    [choresForMonth]
  );

  const personById = useCallback(
    (id: string) => state.people.find((p) => p.id === id),
    [state.people]
  );

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  }, []);

  const addChore = useCallback((chore: Omit<Chore, "id" | "createdAt">) => {
    const newChore: Chore = {
      ...chore,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, chores: [...prev.chores, newChore] }));
  }, []);

  const updateChore = useCallback(
    (id: string, updates: Partial<Chore>, updateAll = false) => {
      setState((prev) => {
        const isStored = !!prev.chores.find((c) => c.id === id);

        if (!isStored) {
          const parsed = parseVirtualId(id);
          if (!parsed) return prev;
          const { parentId, date } = parsed;
          const parent = prev.chores.find((c) => c.id === parentId);
          if (!parent) return prev;

          const existingOverride = prev.chores.find(
            (c) => c.parentId === parentId && c.date === date
          );
          if (existingOverride) {
            return {
              ...prev,
              chores: prev.chores.map((c) =>
                c.id === existingOverride.id ? { ...c, ...updates } : c
              ),
            };
          }
          const override: Chore = {
            ...parent,
            ...updates,
            id: generateId(),
            date,
            parentId,
            createdAt: parent.createdAt,
          };
          return { ...prev, chores: [...prev.chores, override] };
        }

        if (updateAll) {
          const chore = prev.chores.find((c) => c.id === id);
          const parentId = chore?.parentId ?? id;
          return {
            ...prev,
            chores: prev.chores.map((c) =>
              c.id === parentId || c.parentId === parentId
                ? { ...c, ...updates }
                : c
            ),
          };
        }

        return {
          ...prev,
          chores: prev.chores.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        };
      });
    },
    []
  );

  const deleteChore = useCallback((id: string, deleteAll = false) => {
    setState((prev) => {
      const isStored = !!prev.chores.find((c) => c.id === id);

      if (!isStored) {
        const parsed = parseVirtualId(id);
        if (!parsed) return prev;
        const { parentId } = parsed;
        if (deleteAll) {
          return {
            ...prev,
            chores: prev.chores.filter(
              (c) => c.id !== parentId && c.parentId !== parentId
            ),
          };
        }
        return prev;
      }

      const chore = prev.chores.find((c) => c.id === id);
      const parentId = chore?.parentId ?? id;

      if (deleteAll) {
        return {
          ...prev,
          chores: prev.chores.filter(
            (c) => c.id !== parentId && c.parentId !== parentId
          ),
        };
      }

      return {
        ...prev,
        chores: prev.chores.filter((c) => c.id !== id),
      };
    });
  }, []);

  const toggleComplete = useCallback((chore: Chore) => {
    const isVirtual =
      !chore.id.match(/^[a-z0-9]+$/) && !!chore.parentId;
    if (isVirtual) {
      setState((prev) => {
        const existing = prev.chores.find(
          (c) => c.parentId === chore.parentId && c.date === chore.date
        );
        if (existing) {
          return {
            ...prev,
            chores: prev.chores.map((c) =>
              c.id === existing.id ? { ...c, completed: !c.completed } : c
            ),
          };
        }
        const parent = prev.chores.find((c) => c.id === chore.parentId);
        if (!parent) return prev;
        const override: Chore = {
          ...parent,
          id: generateId(),
          date: chore.date,
          parentId: chore.parentId,
          completed: !chore.completed,
          createdAt: parent.createdAt,
        };
        return { ...prev, chores: [...prev.chores, override] };
      });
    } else {
      setState((prev) => ({
        ...prev,
        chores: prev.chores.map((c) =>
          c.id === chore.id ? { ...c, completed: !c.completed } : c
        ),
      }));
    }
  }, []);

  const addPerson = useCallback((name: string, color: string) => {
    const person: Person = { id: generateId(), name, color };
    setState((prev) => ({ ...prev, people: [...prev.people, person] }));
  }, []);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setState((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const deletePerson = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== id),
      chores: prev.chores.map((c) =>
        c.assigneeId === id ? { ...c, assigneeId: null } : c
      ),
    }));
  }, []);

  const openModal = useCallback((data: ChoreModalData) => {
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setModalData(null);
  }, []);

  const value: ChoreContextValue = {
    state,
    currentYear,
    currentMonth,
    selectedDate,
    modalData,
    choresForMonth,
    choresForDate,
    personById,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    setSelectedDate,
    addChore,
    updateChore,
    deleteChore,
    toggleComplete,
    addPerson,
    updatePerson,
    deletePerson,
    openModal,
    closeModal,
  };

  return (
    <ChoreContext.Provider value={value}>{children}</ChoreContext.Provider>
  );
}

export function useChores() {
  const ctx = useContext(ChoreContext);
  if (!ctx) throw new Error("useChores must be used within ChoreProvider");
  return ctx;
}
