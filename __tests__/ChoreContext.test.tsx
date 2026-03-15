import React from "react";
import { act, renderHook } from "@testing-library/react";
import { ChoreProvider, useChores, parseVirtualId } from "@/context/ChoreContextV2";
import { Chore } from "@/types";
import { formatDate } from "@/lib/storageV2";

// ─── helpers ────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChoreProvider>{children}</ChoreProvider>
);

function makeChoreInput(
  overrides: Partial<Omit<Chore, "id" | "createdAt">> = {}
): Omit<Chore, "id" | "createdAt"> {
  const now = new Date();
  return {
    title: "Test Chore",
    assigneeId: null,
    date: formatDate(new Date(now.getFullYear(), now.getMonth(), 15)),
    completed: false,
    recurrence: "none",
    ...overrides,
  };
}

// ─── parseVirtualId ──────────────────────────────────────────────────────────

describe("parseVirtualId", () => {
  it("parses a valid virtual ID", () => {
    const result = parseVirtualId("abc123_2025-01-15");
    expect(result).toEqual({ parentId: "abc123", date: "2025-01-15" });
  });

  it("returns null for a stored chore ID (no date suffix)", () => {
    expect(parseVirtualId("abc123def456")).toBeNull();
  });

  it("returns null for a string shorter than 12 characters", () => {
    expect(parseVirtualId("short")).toBeNull();
  });

  it("returns null when suffix is not a valid date pattern", () => {
    expect(parseVirtualId("abc123_not-a-date")).toBeNull();
  });

  it("handles IDs where parent itself contains underscores", () => {
    const result = parseVirtualId("some_parent_id_2025-12-31");
    expect(result).toEqual({ parentId: "some_parent_id", date: "2025-12-31" });
  });
});

// ─── useChores outside provider ──────────────────────────────────────────────

describe("useChores", () => {
  it("throws when called outside ChoreProvider", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => renderHook(() => useChores())).toThrow(
      "useChores must be used within ChoreProvider"
    );
    consoleError.mockRestore();
  });
});

// ─── initial state ───────────────────────────────────────────────────────────

describe("ChoreProvider initial state", () => {
  beforeEach(() => localStorage.clear());

  it("starts with an empty chores list", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    expect(result.current.state.chores).toHaveLength(0);
  });

  it("starts with the 4 default people", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    expect(result.current.state.people).toHaveLength(4);
    expect(result.current.state.people.map((p) => p.name)).toEqual([
      "Alex",
      "Jordan",
      "Sam",
      "Taylor",
    ]);
  });

  it("initialises currentYear and currentMonth to today", () => {
    const now = new Date();
    const { result } = renderHook(() => useChores(), { wrapper });
    expect(result.current.currentYear).toBe(now.getFullYear());
    expect(result.current.currentMonth).toBe(now.getMonth());
  });

  it("starts with no selected date", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    expect(result.current.selectedDate).toBeNull();
  });

  it("starts with no open modal", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    expect(result.current.modalData).toBeNull();
  });
});

// ─── chore CRUD ───────────────────────────────────────────────────────────────

describe("addChore", () => {
  beforeEach(() => localStorage.clear());

  it("adds a chore to state", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput({ title: "Vacuum" })));
    expect(result.current.state.chores).toHaveLength(1);
    expect(result.current.state.chores[0].title).toBe("Vacuum");
  });

  it("assigns a non-empty ID to the new chore", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput()));
    expect(result.current.state.chores[0].id).toBeTruthy();
  });

  it("assigns a createdAt timestamp", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput()));
    const { createdAt } = result.current.state.chores[0];
    expect(new Date(createdAt).getTime()).not.toBeNaN();
  });

  it("each added chore receives a unique ID", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => {
      result.current.addChore(makeChoreInput({ title: "A" }));
      result.current.addChore(makeChoreInput({ title: "B" }));
    });
    const [a, b] = result.current.state.chores;
    expect(a.id).not.toBe(b.id);
  });
});

describe("deleteChore", () => {
  beforeEach(() => localStorage.clear());

  it("removes the targeted chore", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput({ title: "To Delete" })));
    const id = result.current.state.chores[0].id;
    act(() => result.current.deleteChore(id));
    expect(result.current.state.chores).toHaveLength(0);
  });

  it("leaves other chores untouched", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => {
      result.current.addChore(makeChoreInput({ title: "Keep" }));
      result.current.addChore(makeChoreInput({ title: "Delete" }));
    });
    const deleteId = result.current.state.chores[1].id;
    act(() => result.current.deleteChore(deleteId));
    expect(result.current.state.chores).toHaveLength(1);
    expect(result.current.state.chores[0].title).toBe("Keep");
  });

  it("with deleteAll=true removes parent and all overrides", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() =>
      result.current.addChore(
        makeChoreInput({ title: "Parent", recurrence: "weekly" })
      )
    );
    const parentId = result.current.state.chores[0].id;
    // Simulate a stored override (child)
    act(() =>
      result.current.addChore(
        makeChoreInput({ title: "Override", parentId, recurrence: "weekly" })
      )
    );
    act(() => result.current.deleteChore(parentId, true));
    const remaining = result.current.state.chores.filter(
      (c) => c.id === parentId || c.parentId === parentId
    );
    expect(remaining).toHaveLength(0);
  });
});

describe("updateChore", () => {
  beforeEach(() => localStorage.clear());

  it("updates the specified field", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput({ title: "Old" })));
    const id = result.current.state.chores[0].id;
    act(() => result.current.updateChore(id, { title: "New" }));
    expect(result.current.state.chores[0].title).toBe("New");
  });

  it("does not affect other chores", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => {
      result.current.addChore(makeChoreInput({ title: "First" }));
      result.current.addChore(makeChoreInput({ title: "Second" }));
    });
    const firstId = result.current.state.chores[0].id;
    act(() => result.current.updateChore(firstId, { title: "Updated" }));
    expect(result.current.state.chores[1].title).toBe("Second");
  });

  it("with updateAll=true updates parent and all overrides", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() =>
      result.current.addChore(
        makeChoreInput({ title: "Weekly", recurrence: "weekly" })
      )
    );
    const parentId = result.current.state.chores[0].id;
    act(() =>
      result.current.addChore(
        makeChoreInput({ title: "Override", parentId, recurrence: "weekly" })
      )
    );
    act(() => result.current.updateChore(parentId, { title: "Bulk Update" }, true));
    result.current.state.chores.forEach((c) => {
      if (c.id === parentId || c.parentId === parentId) {
        expect(c.title).toBe("Bulk Update");
      }
    });
  });
});

describe("toggleComplete", () => {
  beforeEach(() => localStorage.clear());

  it("marks an incomplete chore as complete", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput({ completed: false })));
    const chore = result.current.state.chores[0];
    act(() => result.current.toggleComplete(chore));
    expect(result.current.state.chores[0].completed).toBe(true);
  });

  it("marks a complete chore as incomplete", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput({ completed: true })));
    const chore = result.current.state.chores[0];
    act(() => result.current.toggleComplete(chore));
    expect(result.current.state.chores[0].completed).toBe(false);
  });

  it("toggling twice returns to the original state", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addChore(makeChoreInput({ completed: false })));
    const chore = result.current.state.chores[0];
    act(() => result.current.toggleComplete(chore));
    act(() => result.current.toggleComplete(result.current.state.chores[0]));
    expect(result.current.state.chores[0].completed).toBe(false);
  });
});

// ─── person operations ────────────────────────────────────────────────────────

describe("addPerson", () => {
  beforeEach(() => localStorage.clear());

  it("adds a person to the people list", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const before = result.current.state.people.length;
    act(() => result.current.addPerson("Charlie", "#abc123"));
    expect(result.current.state.people).toHaveLength(before + 1);
  });

  it("stores the correct name and color", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.addPerson("Dana", "#ff0000"));
    const dana = result.current.state.people.find((p) => p.name === "Dana");
    expect(dana?.color).toBe("#ff0000");
  });

  it("assigns a unique ID to the new person", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => {
      result.current.addPerson("Eve", "#aaa");
      result.current.addPerson("Frank", "#bbb");
    });
    const ids = result.current.state.people.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("deletePerson", () => {
  beforeEach(() => localStorage.clear());

  it("removes the person from the list", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const person = result.current.state.people[0];
    act(() => result.current.deletePerson(person.id));
    expect(
      result.current.state.people.find((p) => p.id === person.id)
    ).toBeUndefined();
  });

  it("nullifies assigneeId on chores assigned to the deleted person", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const person = result.current.state.people[0];
    act(() =>
      result.current.addChore(makeChoreInput({ assigneeId: person.id }))
    );
    act(() => result.current.deletePerson(person.id));
    expect(result.current.state.chores[0].assigneeId).toBeNull();
  });

  it("leaves chores assigned to other people unchanged", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const [person1, person2] = result.current.state.people;
    act(() =>
      result.current.addChore(makeChoreInput({ assigneeId: person2.id }))
    );
    act(() => result.current.deletePerson(person1.id));
    expect(result.current.state.chores[0].assigneeId).toBe(person2.id);
  });
});

describe("updatePerson", () => {
  beforeEach(() => localStorage.clear());

  it("updates the person's name", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const person = result.current.state.people[0];
    act(() => result.current.updatePerson(person.id, { name: "NewName" }));
    const updated = result.current.state.people.find((p) => p.id === person.id);
    expect(updated?.name).toBe("NewName");
  });

  it("updates the person's color", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const person = result.current.state.people[0];
    act(() => result.current.updatePerson(person.id, { color: "#ffffff" }));
    const updated = result.current.state.people.find((p) => p.id === person.id);
    expect(updated?.color).toBe("#ffffff");
  });
});

// ─── personById helper ────────────────────────────────────────────────────────

describe("personById", () => {
  beforeEach(() => localStorage.clear());

  it("returns the matching person", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const person = result.current.state.people[0];
    expect(result.current.personById(person.id)).toEqual(person);
  });

  it("returns undefined for an unknown ID", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    expect(result.current.personById("does-not-exist")).toBeUndefined();
  });
});

// ─── calendar navigation ──────────────────────────────────────────────────────

describe("goToNextMonth", () => {
  it("advances the month by one", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const initialMonth = result.current.currentMonth;
    act(() => result.current.goToNextMonth());
    const expected = initialMonth === 11 ? 0 : initialMonth + 1;
    expect(result.current.currentMonth).toBe(expected);
  });

  it("increments the year when going from December to January", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    // Advance to December
    const stepsToDecember = (11 - result.current.currentMonth + 12) % 12;
    for (let i = 0; i < stepsToDecember; i++) {
      act(() => result.current.goToNextMonth());
    }
    const yearBeforeWrap = result.current.currentYear;
    act(() => result.current.goToNextMonth());
    expect(result.current.currentMonth).toBe(0);
    expect(result.current.currentYear).toBe(yearBeforeWrap + 1);
  });
});

describe("goToPrevMonth", () => {
  it("decrements the month by one", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const initialMonth = result.current.currentMonth;
    act(() => result.current.goToPrevMonth());
    const expected = initialMonth === 0 ? 11 : initialMonth - 1;
    expect(result.current.currentMonth).toBe(expected);
  });

  it("decrements the year when going from January to December", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    // Retreat to January
    const stepsToJanuary = result.current.currentMonth;
    for (let i = 0; i < stepsToJanuary; i++) {
      act(() => result.current.goToPrevMonth());
    }
    const yearBeforeWrap = result.current.currentYear;
    act(() => result.current.goToPrevMonth());
    expect(result.current.currentMonth).toBe(11);
    expect(result.current.currentYear).toBe(yearBeforeWrap - 1);
  });
});

describe("goToToday", () => {
  it("resets to the current month and year after navigating away", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => {
      result.current.goToNextMonth();
      result.current.goToNextMonth();
      result.current.goToNextMonth();
    });
    act(() => result.current.goToToday());
    const now = new Date();
    expect(result.current.currentMonth).toBe(now.getMonth());
    expect(result.current.currentYear).toBe(now.getFullYear());
  });
});

// ─── modal ────────────────────────────────────────────────────────────────────

describe("modal management", () => {
  it("openModal sets the modal data", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.openModal({ mode: "add", date: "2025-01-15" }));
    expect(result.current.modalData).toEqual({ mode: "add", date: "2025-01-15" });
  });

  it("openModal in edit mode stores the chore reference", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const chore: Chore = {
      id: "c1",
      title: "Test",
      assigneeId: null,
      date: "2025-01-15",
      completed: false,
      recurrence: "none",
      createdAt: new Date().toISOString(),
    };
    act(() => result.current.openModal({ mode: "edit", chore }));
    expect(result.current.modalData?.mode).toBe("edit");
    expect(result.current.modalData?.chore?.id).toBe("c1");
  });

  it("closeModal clears the modal data", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.openModal({ mode: "add" }));
    act(() => result.current.closeModal());
    expect(result.current.modalData).toBeNull();
  });
});

// ─── selectedDate ─────────────────────────────────────────────────────────────

describe("setSelectedDate", () => {
  it("stores the selected date", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.setSelectedDate("2025-01-10"));
    expect(result.current.selectedDate).toBe("2025-01-10");
  });

  it("can clear the selected date to null", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    act(() => result.current.setSelectedDate("2025-01-10"));
    act(() => result.current.setSelectedDate(null));
    expect(result.current.selectedDate).toBeNull();
  });
});

// ─── choresForDate query ──────────────────────────────────────────────────────

describe("choresForDate", () => {
  beforeEach(() => localStorage.clear());

  it("returns only chores matching the requested date in the current month view", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const now = new Date();
    const dateA = formatDate(new Date(now.getFullYear(), now.getMonth(), 5));
    const dateB = formatDate(new Date(now.getFullYear(), now.getMonth(), 20));

    act(() => {
      result.current.addChore(makeChoreInput({ title: "Morning Sweep", date: dateA }));
      result.current.addChore(makeChoreInput({ title: "Evening Wash", date: dateB }));
    });

    const choresA = result.current.choresForDate(dateA);
    const choresB = result.current.choresForDate(dateB);

    expect(choresA.some((c) => c.title === "Morning Sweep")).toBe(true);
    expect(choresA.some((c) => c.title === "Evening Wash")).toBe(false);
    expect(choresB.some((c) => c.title === "Evening Wash")).toBe(true);
  });

  it("returns an empty array for a date with no chores", () => {
    const { result } = renderHook(() => useChores(), { wrapper });
    const now = new Date();
    const emptyDate = formatDate(new Date(now.getFullYear(), now.getMonth(), 28));
    expect(result.current.choresForDate(emptyDate)).toHaveLength(0);
  });
});
