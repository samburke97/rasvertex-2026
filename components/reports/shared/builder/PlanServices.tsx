"use client";
// The maintenance plan / recommended works editor shared by the report
// builders: the services in the plan, in the order they print (drag the grip
// to reorder), each with its priority, frequency and next due; services not
// in the plan sit below as chips to add. The technician's comments print
// under the table. The builder adds its own on/off switch, title and intro.

import type { MaintenancePlan, PlanItem, PlanPreset } from "@/lib/reports/maintenancePlan";
import { PLAN_INTERVALS, requiredFirst } from "@/lib/reports/maintenancePlan";
import InfoTip from "./InfoTip";
import RichBox from "./RichBox";
import { Grip, moveItem, useSortable } from "./Sortable";
import styles from "./PlanServices.module.css";

/** The services to start with: the required presets, and any that match
 *  defects found in the report; required first. */
export const seedPlan = (presets: PlanPreset[], present: string[] = []): PlanItem[] =>
  requiredFirst(
    presets
      .filter((s) => s.priority === "required" || s.whenAny?.some((c) => present.includes(c)))
      .map(({ service, interval, priority }) => ({ service, interval, priority })),
  );

export default function PlanServices({
  presets,
  plan,
  onPlan,
}: {
  presets: PlanPreset[];
  plan: MaintenancePlan | undefined;
  onPlan: (plan: MaintenancePlan) => void;
}) {
  const items = plan?.items ?? [];
  const set = (next: PlanItem[]) => onPlan({ ...plan, items: next });
  const patch = (i: number, p: Partial<PlanItem>) => set(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const sort = useSortable((from, to) => set(moveItem(items, from, to)));
  const unused = presets.filter((s) => !items.some((x) => x.service === s.service));

  return (
    <>
      <div className={styles.section}>
        <div className={styles.title}>
          Services{items.length > 0 && <span className={styles.count}>{items.length}</span>}
          <InfoTip>Printed in this order: drag ⋮⋮ to move a service. Click the priority to switch it.</InfoTip>
        </div>
        {items.length ? (
          <div className={styles.list}>
            {items.map((x, i) => (
              <div key={i} {...sort.row(i)} className={`${styles.item} ${sort.cls(i)}`}>
                <Grip {...sort.grip(i)} />
                <div className={styles.body}>
                  <div className={styles.head}>
                    <input
                      className={styles.name}
                      value={x.service}
                      placeholder="Describe the service"
                      autoFocus={!x.service}
                      onChange={(e) => patch(i, { service: e.target.value })}
                    />
                    <button
                      className={`${styles.prio} ${x.priority === "required" ? styles.prioReq : ""}`}
                      title="Click to switch between Required and Recommended"
                      onClick={() => patch(i, { priority: x.priority === "required" ? "recommended" : "required" })}
                    >
                      {x.priority === "required" ? "Required" : "Recommended"}
                    </button>
                    <button className={styles.remove} title="Remove from the plan" aria-label="Remove" onClick={() => set(items.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </div>
                  <div className={styles.timing}>
                    <select className={`${styles.input} ${styles.select}`} value={x.interval} onChange={(e) => patch(i, { interval: e.target.value })}>
                      {[...new Set([x.interval, ...PLAN_INTERVALS])].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                    <input className={styles.input} value={x.next ?? ""} placeholder="Next due (optional)" onChange={(e) => patch(i, { next: e.target.value || undefined })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No services yet. Add one below.</div>
        )}
        <div className={styles.addTitle}>Add a service</div>
        <div className={styles.chips}>
          {unused.map((s) => (
            <button key={s.service} className={styles.chip} onClick={() => set([...items, { service: s.service, interval: s.interval, priority: s.priority }])}>
              <span className={styles.plus}>+</span>
              {s.service}
            </button>
          ))}
          <button className={`${styles.chip} ${styles.chipOwn}`} onClick={() => set([...items, { service: "", interval: "Annually", priority: "recommended" }])}>
            <span className={styles.plus}>+</span>
            Your own
          </button>
        </div>
      </div>
      <div className={styles.section} data-field="plan.notes" data-panel-field="planNotes">
        <div className={styles.title}>
          Technician comments <InfoTip>What this plan looks like in practice: priorities, budgeting, anything to watch. Printed under the table.</InfoTip>
        </div>
        <RichBox value={plan?.notes ?? ""} onChange={(notes) => onPlan({ items, ...plan, notes })} />
      </div>
    </>
  );
}
