// lib/reports/jobAlerts.ts
//
// Weekly schedule alerts: for each job cost centre on the schedule, the
// estimate against what's been used and what's still booked, so a job set
// to run over is caught at the schedule stage.
//
// SimPRO counts every scheduled block up to and including today as actual
// labour (Totals.ResourcesCost.LaborHours.Actual; checked against live
// jobs, November 2026). Blocks after today aren't in it yet, so
//   finish = actual + still booked.
// Cost runs the same way: the resources cost so far, plus the hours still
// booked at the rate the job has cost per hour so far.

export interface CostCentreCheck {
  /** "11195-13747". */
  key: string;
  jobId: string;
  ccId: string;
  site: string;
  /** The cost centre's name ("Waterproofing"). */
  name: string;
  estHours: number;
  actualHours: number;
  /** Booked after today. */
  futureHours: number;
  estCost: number;
  actualCost: number;
  /** Hours per team member on this cost centre, used and booked, most first. */
  team: { name: string; hours: number }[];
}

export type AlertLevel = "over" | "going" | "noEstimate";

export interface JobAlert extends CostCentreCheck {
  level: AlertLevel;
  finishHours: number;
  finishCost: number;
  /** What's wrong, one line each. */
  lines: string[];
}

export const ALERT_LABEL: Record<AlertLevel, string> = {
  over: "Over estimate",
  going: "Set to go over",
  noEstimate: "No estimate",
};

// Small overruns aren't alerts: over by more than 5%, and by at least
// half an hour or $100.
const overHours = (n: number, est: number) => n - est > Math.max(0.5, est * 0.05);
const overCost = (n: number, est: number) => n - est > Math.max(100, est * 0.05);

const h = (n: number) => `${Math.round(n * 10) / 10}h`;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const RATES = ", with hours on estimate: the team's rates are above the estimate's.";

export function checkCostCentre(c: CostCentreCheck): JobAlert | null {
  const finishHours = c.actualHours + c.futureHours;
  const rate = c.actualHours > 0 ? c.actualCost / c.actualHours : 0;
  const finishCost = c.actualCost + c.futureHours * rate;
  const lines: string[] = [];
  let level: AlertLevel | null = null;

  if (c.estHours <= 0) {
    if (finishHours <= 0) return null;
    return {
      ...c,
      level: "noEstimate",
      finishHours,
      finishCost,
      lines: [`${h(finishHours)} used and booked, with no estimated hours to check against.`],
    };
  }

  // Hours.
  if (overHours(c.actualHours, c.estHours)) {
    level = "over";
    lines.push(
      `${h(c.actualHours)} used of ${h(c.estHours)} estimated (+${h(c.actualHours - c.estHours)})` +
        (c.futureHours > 0 ? `; with ${h(c.futureHours)} more booked it finishes at ${h(finishHours)} (+${h(finishHours - c.estHours)}).` : "."),
    );
  } else if (overHours(finishHours, c.estHours)) {
    level = "going";
    lines.push(`${h(c.actualHours)} used + ${h(c.futureHours)} booked = ${h(finishHours)} of ${h(c.estHours)} estimated (+${h(finishHours - c.estHours)}).`);
  }

  // Cost: over with the hours on estimate means the team booked costs more
  // per hour than the estimate allowed.
  if (c.estCost > 0) {
    const hoursOk = !overHours(finishHours, c.estHours);
    if (overCost(c.actualCost, c.estCost)) {
      level = "over";
      lines.push(`Resources cost ${money(c.actualCost)} of ${money(c.estCost)} estimated (+${money(c.actualCost - c.estCost)})${hoursOk ? RATES : "."}`);
    } else if (overCost(finishCost, c.estCost)) {
      level ??= "going";
      lines.push(`Resources cost set to reach ${money(finishCost)} of ${money(c.estCost)} estimated (+${money(finishCost - c.estCost)})${hoursOk ? RATES : "."}`);
    }
  }

  return level ? { ...c, level, finishHours, finishCost, lines } : null;
}

const RANK: Record<AlertLevel, number> = { over: 0, going: 1, noEstimate: 2 };

/** Worst first, then by how far over. */
export const sortAlerts = (a: JobAlert[]) =>
  [...a].sort((x, y) => RANK[x.level] - RANK[y.level] || y.finishHours - y.estHours - (x.finishHours - x.estHours));
