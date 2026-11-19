// components/reports/shared/doc/PlanTable.tsx
//
// The maintenance plan table, as printed in every report that has one (the
// Job overview's Recommended works, the inspection reports' Maintenance
// plan): Service, Frequency, Priority and, when any service has one, Next
// due. Hook-free, so the PDF routes render it too.
//
// Each report keeps its own table base (rules, type size) and passes it in
// as `base`; the columns and the priority chip are defined once here, in
// PLAN_CSS, which each document adds to its stylesheet. Rows are separate
// so a report can paginate them one at a time.

import type { PlanItem } from "@/lib/reports/maintenancePlan";

export const PLAN_CSS = `
.rv-plan{grid-template-columns:minmax(0,1fr) 200px 170px}
.rv-plan--next{grid-template-columns:minmax(0,1fr) 190px 170px 170px}
.rv-plan.rv-plan-row,.rv-plan--next.rv-plan-row{padding-top:16px;padding-bottom:16px}
.rv-plan-service{font-size:20px;font-weight:600;line-height:1.3}
.rv-plan-note{margin-top:4px;font-size:17px;line-height:1.4;color:var(--ink-65)}
.rv-plan-dim{font-size:20px;color:var(--ink-65)}
.rv-prio{justify-self:start;display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;line-height:1}
.rv-prio--required{background:#fcf0dc;color:#86561a}
.rv-prio--recommended{background:#eef1f6;color:rgba(1,25,85,.72)}
`;

const cols = (next: boolean) => (next ? "rv-plan--next" : "rv-plan");

/** The header row. `base` is the report's table-head class. */
export function PlanHead({ next, base }: { next: boolean; base: string }) {
  return (
    <div className={`${base} ${cols(next)}`}>
      <span>Service</span>
      <span>Frequency</span>
      <span>Priority</span>
      {next && <span>Next due</span>}
    </div>
  );
}

/** One service. `base` is the report's table-row class (and its rule). */
export function PlanRow({ item, next, base, edit }: { item: PlanItem; next: boolean; base: string; edit?: string }) {
  return (
    <div className={`${base} ${cols(next)} rv-plan-row`} data-edit={edit}>
      <div>
        <div className="rv-plan-service">{item.service}</div>
        {item.note?.trim() && <div className="rv-plan-note">{item.note}</div>}
      </div>
      <span className="rv-plan-dim">{item.interval}</span>
      <span className={`rv-prio rv-prio--${item.priority}`}>{item.priority === "required" ? "Required" : "Recommended"}</span>
      {next && <span className="rv-plan-dim">{item.next || "—"}</span>}
    </div>
  );
}
