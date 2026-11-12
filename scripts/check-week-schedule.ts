// scripts/check-week-schedule.ts
// Checks for the Weekly schedule's cleaning rules (dayItems in
// lib/reports/weekSchedule.ts). Run: npm run check:week-schedule

import assert from "node:assert/strict";
import {
  buildWeekModel,
  cleanSite,
  dayItems,
  DEFAULT_WEEK_OPTIONS,
  emptyDraft,
  fillItem,
  indexEntries,
  isLeave,
  removeItem,
  renameItem,
  resetDays,
  setItemDays,
  SPLIT_MIN_HOURS,
  type WeekEntry,
  type WeekScheduleResponse,
} from "../lib/reports/weekSchedule";

const e = (label: string, hours: number, kind: WeekEntry["kind"] = "job", ref: string | null = null): WeekEntry => ({
  staffId: 1,
  date: "2026-11-16",
  kind,
  label,
  ref,
  name: "",
  hours,
});
const show = (entries: WeekEntry[]) => dayItems(entries).map((i) => `${i.label}${i.hours ? ` ${i.hours}h` : ""}`);

const checks: [string, () => void][] = [
  ["RDO and a job: the job when it has more hours", () => assert.deepEqual(show([e("RDO", 2, "activity"), e("Cosmo", 6)]), ["Cosmo 6h"])],
  ["RDO and a job: the RDO when it has as many hours", () => assert.deepEqual(show([e("RDO", 8, "activity"), e("Cosmo", 8)]), ["RDO 8h"])],
  ["two sites 6h/2h: the 6h site only", () => assert.deepEqual(show([e("Beachport", 6), e("Rovera", 2)]), ["Beachport 6h"])],
  ["two sites 4h/4h: both (a split day)", () => assert.deepEqual(show([e("Emporio", 4), e("Aurora", 4)]), ["Aurora 4h", "Emporio 4h"])],
  [`second site at exactly ${SPLIT_MIN_HOURS}h shows`, () => assert.deepEqual(show([e("Living Choice", 5), e("Yardwork", 3, "activity")]), ["Living Choice 5h", "Yardwork 3h"])],
  ["leave with no hours wins the day", () => assert.deepEqual(show([e("Annual Leave", 0, "activity"), e("Cosmo", 8)]), ["Annual Leave"])],
  [
    "a duplicate job (cost centres, blocks) is one item",
    () => assert.deepEqual(show([e("Ocean Verge", 7, "job", "11300"), e("Ocean Verge", 1, "job", "11300")]), ["Ocean Verge 8h"]),
  ],
  [
    "the same site on two jobs keeps both numbers",
    () => assert.deepEqual(dayItems([e("Iluka BC", 3.5, "job", "1"), e("Iluka BC", 2, "job", "2")])[0].refs, ["1", "2"]),
  ],
  ["zero-hour schedules drop out next to timed ones", () => assert.deepEqual(show([e("Inspection", 0), e("Cosmo", 8)]), ["Cosmo 8h"])],
  ["a zero-hour schedule alone still shows", () => assert.deepEqual(show([e("Inspection", 0)]), ["Inspection"])],
  ["short yardwork beside a full day is left off", () => assert.deepEqual(show([e("Yardwork", 0.5, "activity"), e("Cosmopolitan", 8)]), ["Cosmopolitan 8h"])],
  ["never a site and leave together", () => assert.equal(dayItems([e("Sick / Personal Leave", 4, "activity"), e("Cosmo", 4)]).length, 1)],
  ["leave names", () => assert.ok(["Annual Leave", "RDO", "Sick / Personal Leave", "Casual - Public Holiday", "Unpaid Leave", "Work Cover"].every(isLeave))],
  ["working activities aren't leave", () => assert.ok(!["Yardwork", "Training", "Toolbox Meeting", "Workshop", "Tafe"].some(isLeave))],
  ["site names lose the scheme number", () => assert.equal(cleanSite("Platinum Residential CTS 33637 "), "Platinum Residential")],
  ["and a trailing state and postcode", () => assert.equal(cleanSite("9 Ormonde Terrace Kings Beach QLD 4551"), "9 Ormonde Terrace Kings Beach")],
  ["and double spaces", () => assert.equal(cleanSite("6 lomandra  Coolum Beach"), "6 lomandra Coolum Beach")],
  ...editChecks(),
];

// ── Edits over a small week: Adam on Cosmopolitan Mon–Fri, Ben free ──────────
function editChecks(): [string, () => void][] {
  const days = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
  const data: WeekScheduleResponse = {
    from: days[0],
    to: "2026-11-22",
    staff: [
      { id: 1, name: "Adam" },
      { id: 2, name: "Ben" },
    ],
    entries: days.map((date) => ({ staffId: 1, date, kind: "job" as const, label: "Cosmopolitan", ref: "11321", name: "", hours: 8 })),
    skipped: 0,
  };
  const range = { from: days[0], to: "2026-11-22" };
  const ctx = { byDay: indexEntries(data.entries), aliases: {} as Record<string, string> };
  const bar = { staffId: 1, days, item: 0 };
  const row = (d: ReturnType<typeof emptyDraft>, id = 1, aliases = {}) =>
    buildWeekModel(data, range, DEFAULT_WEEK_OPTIONS, [], d, aliases).rows.find((r) => r.staffId === id)!.cells.map((c) => c.map((i) => i.label).join("+") || "—");
  return [
    ["one bar for the week", () => assert.equal(buildWeekModel(data, range, DEFAULT_WEEK_OPTIONS).pages[0].rows[0].runs.length, 1)],
    ["remove takes it off every day", () => assert.deepEqual(row(removeItem(ctx, emptyDraft(), bar)), ["—", "—", "—", "—", "—"])],
    [
      "rename through an alias (every week)",
      () => {
        const r = renameItem(ctx, emptyDraft(), bar, "Cosmo");
        assert.deepEqual(r.aliases, { Cosmopolitan: "Cosmo" });
        assert.deepEqual(row(r.draft, 1, r.aliases!), ["Cosmo", "Cosmo", "Cosmo", "Cosmo", "Cosmo"]);
      },
    ],
    ["shorten to Mon–Wed", () => assert.deepEqual(row(setItemDays(ctx, emptyDraft(), bar, days.slice(0, 3))), ["Cosmopolitan", "Cosmopolitan", "Cosmopolitan", "—", "—"])],
    [
      "fill an empty day",
      () => {
        const d = fillItem(ctx, emptyDraft(), { staffId: 2, days: [days[2]], item: -1 }, { label: "First Bay by Mosaic", kind: "job", ref: "11357" });
        assert.deepEqual(row(d, 2), ["—", "—", "First Bay by Mosaic", "—", "—"]);
      },
    ],
    [
      "reset puts SimPRO back",
      () => {
        const d = removeItem(ctx, emptyDraft(), bar);
        assert.deepEqual(row(resetDays(d, bar)), ["Cosmopolitan", "Cosmopolitan", "Cosmopolitan", "Cosmopolitan", "Cosmopolitan"]);
      },
    ],
    [
      "TBC pencils someone in: a plain bar, not a site",
      () => {
        const d = fillItem(ctx, emptyDraft(), { staffId: 2, days: [days[0]], item: -1 }, { label: "TBC", kind: "tbc", ref: null });
        const m = buildWeekModel(data, range, DEFAULT_WEEK_OPTIONS, [], d);
        const cell = m.rows.find((r) => r.staffId === 2)!.cells[0][0];
        assert.deepEqual([cell.label, cell.tone, cell.leave, m.siteCount], ["TBC", null, false, 1]);
      },
    ],
    [
      "Off: a plain grey flag, time off, not a site",
      () => {
        const d = fillItem(ctx, emptyDraft(), { staffId: 1, days: [days[0]], item: 0 }, { label: "Off", kind: "off", ref: null });
        const m = buildWeekModel(data, range, DEFAULT_WEEK_OPTIONS, [], d);
        const cell = m.rows.find((r) => r.staffId === 1)!.cells[0];
        assert.deepEqual(cell.map((c) => [c.label, c.tone, c.leave, c.flag]), [["Off", null, true, "off"]]);
      },
    ],
    [
      "an added person shows",
      () => assert.ok(buildWeekModel(data, range, DEFAULT_WEEK_OPTIONS, [], { ...emptyDraft(), people: [{ id: -5, name: "Caro" }] }).rows.some((r) => r.name === "Caro")),
    ],
    [
      "two weeks split by week, at most seven days a page",
      () => {
        const m = buildWeekModel({ ...data, to: "2026-11-29" }, { from: days[0], to: "2026-11-29" }, { ...DEFAULT_WEEK_OPTIONS, weekend: true });
        assert.deepEqual(m.pages.map((p) => p.days.length), [7, 7]);
      },
    ],
  ];
}

let failed = 0;
for (const [name, fn] of checks) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message.split("\n").join("\n    ") : err}`);
  }
}
console.log(failed ? `\n${failed} failed` : `\nAll ${checks.length} passed`);
process.exit(failed ? 1 : 0);
