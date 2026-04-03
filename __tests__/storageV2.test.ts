import {
  generateId,
  formatDate,
  todayString,
  loadState,
  saveState,
  expandRecurringChores,
} from "@/lib/storageV2";
import { Chore } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeChore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: "test-id",
    title: "Test Chore",
    assigneeId: null,
    date: "2025-01-15",
    completed: false,
    recurrence: "none",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── generateId ─────────────────────────────────────────────────────────────

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("generates unique IDs each time", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));
    expect(ids.size).toBe(200);
  });
});

// ─── formatDate ─────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a date in YYYY-MM-DD format", () => {
    expect(formatDate(new Date(2025, 0, 15))).toBe("2025-01-15");
    expect(formatDate(new Date(2025, 11, 31))).toBe("2025-12-31");
    expect(formatDate(new Date(2024, 1, 29))).toBe("2024-02-29"); // leap year
  });

  it("pads month and day with leading zeros", () => {
    expect(formatDate(new Date(2025, 0, 1))).toBe("2025-01-01");
    expect(formatDate(new Date(2025, 8, 9))).toBe("2025-09-09");
  });

  it("handles year boundary dates", () => {
    expect(formatDate(new Date(2025, 11, 31))).toBe("2025-12-31");
    expect(formatDate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

// ─── todayString ────────────────────────────────────────────────────────────

describe("todayString", () => {
  it("returns today's date in YYYY-MM-DD format", () => {
    const expected = formatDate(new Date());
    expect(todayString()).toBe(expected);
  });

  it("matches the YYYY-MM-DD pattern", () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── loadState ──────────────────────────────────────────────────────────────

describe("loadState", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty chores and 4 default people when storage is empty", () => {
    const state = loadState();
    expect(state.chores).toEqual([]);
    expect(state.people).toHaveLength(4);
    expect(state.people.map((p) => p.name)).toEqual([
      "Alex",
      "Jordan",
      "Sam",
      "Taylor",
    ]);
  });

  it("returns default state when localStorage has invalid JSON", () => {
    localStorage.setItem("chore-calendar-data", "not-json{{");
    const state = loadState();
    expect(state.chores).toEqual([]);
    expect(state.people).toHaveLength(4);
  });

  it("falls back to default people when saved state has no people field", () => {
    localStorage.setItem(
      "chore-calendar-data",
      JSON.stringify({ chores: [] })
    );
    const state = loadState();
    expect(state.people).toHaveLength(4);
  });

  it("falls back to empty chores when saved state has no chores field", () => {
    localStorage.setItem(
      "chore-calendar-data",
      JSON.stringify({ people: [] })
    );
    const state = loadState();
    expect(state.chores).toEqual([]);
  });
});

// ─── saveState + loadState roundtrip ────────────────────────────────────────

describe("saveState / loadState roundtrip", () => {
  beforeEach(() => localStorage.clear());

  it("persists and restores chores correctly", () => {
    const chore = makeChore({ id: "c1", title: "Do laundry" });
    saveState({ chores: [chore], people: [] });
    const loaded = loadState();
    expect(loaded.chores).toHaveLength(1);
    expect(loaded.chores[0].title).toBe("Do laundry");
  });

  it("persists and restores people correctly", () => {
    saveState({
      chores: [],
      people: [{ id: "p1", name: "Alice", color: "#ff0000" }],
    });
    const loaded = loadState();
    expect(loaded.people).toHaveLength(1);
    expect(loaded.people[0].name).toBe("Alice");
  });

  it("preserves all chore fields after roundtrip", () => {
    const chore = makeChore({
      id: "c2",
      title: "Vacuum",
      description: "Living room",
      assigneeId: "person-1",
      date: "2025-03-10",
      completed: true,
      recurrence: "weekly",
      recurrenceEndDate: "2025-06-01",
    });
    saveState({ chores: [chore], people: [] });
    const { chores } = loadState();
    expect(chores[0]).toMatchObject({
      title: "Vacuum",
      description: "Living room",
      completed: true,
      recurrence: "weekly",
    });
  });

  it("overwrites previous state on second save", () => {
    saveState({ chores: [makeChore({ id: "c1", title: "First" })], people: [] });
    saveState({ chores: [makeChore({ id: "c2", title: "Second" })], people: [] });
    const { chores } = loadState();
    expect(chores).toHaveLength(1);
    expect(chores[0].title).toBe("Second");
  });
});

// ─── expandRecurringChores ───────────────────────────────────────────────────

describe("expandRecurringChores", () => {
  const YEAR = 2025;
  const JANUARY = 0;

  // ── non-recurring ──────────────────────────────────────────────────────────

  describe("non-recurring chores", () => {
    it("includes a chore whose date is in the current month", () => {
      const chore = makeChore({ date: "2025-01-15", recurrence: "none" });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe("2025-01-15");
    });

    it("excludes a chore from a different month", () => {
      const chore = makeChore({ date: "2025-02-15", recurrence: "none" });
      expect(expandRecurringChores([chore], YEAR, JANUARY)).toHaveLength(0);
    });

    it("excludes a chore from a different year", () => {
      const chore = makeChore({ date: "2024-01-15", recurrence: "none" });
      expect(expandRecurringChores([chore], YEAR, JANUARY)).toHaveLength(0);
    });

    it("includes the first day of the month", () => {
      const chore = makeChore({ date: "2025-01-01", recurrence: "none" });
      expect(expandRecurringChores([chore], YEAR, JANUARY)).toHaveLength(1);
    });

    it("includes the last day of the month", () => {
      const chore = makeChore({ date: "2025-01-31", recurrence: "none" });
      expect(expandRecurringChores([chore], YEAR, JANUARY)).toHaveLength(1);
    });
  });

  // ── daily recurrence ──────────────────────────────────────────────────────

  describe("daily recurrence", () => {
    it("generates one instance per day within the end date", () => {
      const chore = makeChore({
        id: "daily",
        date: "2025-01-01",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-07",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(7);
      expect(result.map((c) => c.date)).toEqual([
        "2025-01-01",
        "2025-01-02",
        "2025-01-03",
        "2025-01-04",
        "2025-01-05",
        "2025-01-06",
        "2025-01-07",
      ]);
    });

    it("fills the entire month when no end date is provided", () => {
      const chore = makeChore({
        id: "daily-full",
        date: "2025-01-01",
        recurrence: "daily",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(31); // January has 31 days
    });

    it("respects a recurrenceEndDate inside the month", () => {
      const chore = makeChore({
        id: "daily-end",
        date: "2025-01-28",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-30",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.date)).toEqual([
        "2025-01-28",
        "2025-01-29",
        "2025-01-30",
      ]);
    });

    it("returns empty when end date is before the month starts", () => {
      const chore = makeChore({
        id: "daily-past",
        date: "2024-12-01",
        recurrence: "daily",
        recurrenceEndDate: "2024-12-31",
      });
      expect(expandRecurringChores([chore], YEAR, JANUARY)).toHaveLength(0);
    });

    it("only includes dates within the month when start is in previous month", () => {
      const chore = makeChore({
        id: "daily-prev",
        date: "2024-12-29",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-03",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(3); // Jan 1, 2, 3
      result.forEach((c) => expect(c.date.startsWith("2025-01")).toBe(true));
    });
  });

  // ── weekly recurrence ─────────────────────────────────────────────────────

  describe("weekly recurrence", () => {
    it("generates one instance per week (Wednesdays in January 2025)", () => {
      // Jan 1 2025 is a Wednesday
      const chore = makeChore({
        id: "weekly",
        date: "2025-01-01",
        recurrence: "weekly",
        recurrenceEndDate: "2025-01-31",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(5);
      expect(result.map((c) => c.date)).toEqual([
        "2025-01-01",
        "2025-01-08",
        "2025-01-15",
        "2025-01-22",
        "2025-01-29",
      ]);
    });

    it("only includes occurrences inside the month when start is in previous month", () => {
      // Dec 25 (Wed) → Jan 1, 8, 15, 22, 29
      const chore = makeChore({
        id: "weekly-prev",
        date: "2024-12-25",
        recurrence: "weekly",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(5);
      result.forEach((c) => expect(c.date.startsWith("2025-01")).toBe(true));
    });
  });

  // ── monthly recurrence ────────────────────────────────────────────────────

  describe("monthly recurrence", () => {
    it("generates one instance for the current month", () => {
      const chore = makeChore({
        id: "monthly",
        date: "2025-01-15",
        recurrence: "monthly",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe("2025-01-15");
    });

    it("produces no instances when monthly start is in a later month", () => {
      // Chore starts Feb 15 — nothing in January
      const chore = makeChore({
        id: "monthly-future",
        date: "2025-02-15",
        recurrence: "monthly",
      });
      expect(expandRecurringChores([chore], YEAR, JANUARY)).toHaveLength(0);
    });
  });

  // ── virtual IDs ───────────────────────────────────────────────────────────

  describe("virtual IDs", () => {
    it("assigns ${parentId}_${date} as the virtual instance ID", () => {
      const chore = makeChore({
        id: "parent-id",
        date: "2025-01-01",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-02",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result[0].id).toBe("parent-id_2025-01-01");
      expect(result[1].id).toBe("parent-id_2025-01-02");
    });

    it("sets parentId on virtual instances", () => {
      const chore = makeChore({
        id: "p1",
        date: "2025-01-01",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-01",
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      expect(result[0].parentId).toBe("p1");
    });

    it("virtual instances always start with completed = false", () => {
      const chore = makeChore({
        id: "p1",
        date: "2025-01-01",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-03",
        completed: true, // parent is completed
      });
      const result = expandRecurringChores([chore], YEAR, JANUARY);
      result.forEach((c) => expect(c.completed).toBe(false));
    });
  });

  // ── overrides ─────────────────────────────────────────────────────────────

  describe("stored overrides", () => {
    it("uses a stored override instead of generating a virtual instance", () => {
      const parent = makeChore({
        id: "parent",
        date: "2025-01-01",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-03",
      });
      const override: Chore = {
        ...parent,
        id: "override-id",
        date: "2025-01-02",
        completed: true,
        parentId: "parent",
      };
      const result = expandRecurringChores([parent, override], YEAR, JANUARY);
      expect(result).toHaveLength(3);
      const jan2 = result.find((c) => c.date === "2025-01-02");
      expect(jan2?.completed).toBe(true);
      expect(jan2?.id).toBe("override-id");
    });

    it("excludes chores with parentId from being treated as a separate parent", () => {
      const parent = makeChore({
        id: "parent",
        date: "2025-01-01",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-02",
      });
      const child: Chore = {
        ...parent,
        id: "child",
        parentId: "parent",
        date: "2025-01-01",
        completed: true,
      };
      const result = expandRecurringChores([parent, child], YEAR, JANUARY);
      // Jan 1 uses the override (child), Jan 2 is virtual → 2 total
      expect(result).toHaveLength(2);
      const jan1 = result.find((c) => c.date === "2025-01-01");
      expect(jan1?.id).toBe("child");
    });
  });

  // ── multiple chores ────────────────────────────────────────────────────────

  describe("multiple chores", () => {
    it("handles a mix of recurring and non-recurring chores", () => {
      const once = makeChore({ id: "one-off", date: "2025-01-10", recurrence: "none" });
      const daily = makeChore({
        id: "d1",
        date: "2025-01-01",
        recurrence: "daily",
        recurrenceEndDate: "2025-01-03",
      });
      const result = expandRecurringChores([once, daily], YEAR, JANUARY);
      expect(result).toHaveLength(4); // 1 one-off + 3 daily
    });

    it("returns empty array when given an empty chores list", () => {
      expect(expandRecurringChores([], YEAR, JANUARY)).toEqual([]);
    });
  });
});
