"use client";
// The maintenance plan editor shared by the report builders: tick a preset
// service (or add your own), set how often and whether it's required; the
// technician's comments print under the table. The builder adds its own
// on/off switch, title and intro around it.

import type { MaintenancePlan, PlanItem, PlanPreset } from "@/lib/reports/maintenancePlan";
import { PLAN_INTERVALS } from "@/lib/reports/maintenancePlan";
import InfoTip from "./InfoTip";
import RichBox from "./RichBox";
import styles from "./PlanServices.module.css";

/** The services to start with: the required presets, and any that match
 *  defects found in the report. */
export const seedPlan = (presets: PlanPreset[], present: string[] = []): PlanItem[] =>
  presets
    .filter((s) => s.priority === "required" || s.whenAny?.some((c) => present.includes(c)))
    .map(({ service, interval, priority }) => ({ service, interval, priority }));

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
  const custom = items.filter((x) => !presets.some((s) => s.service === x.service));

  /** Required / Recommended, as on the page; click to switch. */
  const prio = (x: PlanItem, i: number) => (
    <button
      className={`${styles.prio} ${x.priority === "required" ? styles.prioReq : ""}`}
      title="Click to switch between Required and Recommended"
      onClick={() => patch(i, { priority: x.priority === "required" ? "recommended" : "required" })}
    >
      {x.priority === "required" ? "Required" : "Recommended"}
    </button>
  );
  /** How often and when next, side by side under the service. */
  const timing = (x: PlanItem, i: number) => (
    <div className={styles.timing}>
      <select className={`${styles.input} ${styles.select}`} value={x.interval} onChange={(e) => patch(i, { interval: e.target.value })}>
        {[...new Set([x.interval, ...PLAN_INTERVALS])].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <input className={styles.input} value={x.next ?? ""} placeholder="Next due" onChange={(e) => patch(i, { next: e.target.value || undefined })} />
    </div>
  );

  return (
    <>
      <div className={styles.section}>
        <div className={styles.title}>
          Services <InfoTip>Tick each service the plan includes. Required ones print first.</InfoTip>
        </div>
        {presets.map((s) => {
          const i = items.findIndex((x) => x.service === s.service);
          return (
            <div key={s.service} className={styles.service}>
              <div className={styles.head}>
                <label className={styles.tick}>
                  <input
                    type="checkbox"
                    checked={i >= 0}
                    onChange={(e) =>
                      set(
                        e.target.checked
                          ? [...items, { service: s.service, interval: s.interval, priority: s.priority }]
                          : items.filter((x) => x.service !== s.service),
                      )
                    }
                  />
                  <span>{s.service}</span>
                </label>
                {i >= 0 && prio(items[i], i)}
              </div>
              {i >= 0 && timing(items[i], i)}
            </div>
          );
        })}
        {custom.map((x) => {
          const i = items.indexOf(x);
          return (
            <div key={`own-${i}`} className={styles.service}>
              <div className={styles.head}>
                <input className={styles.input} value={x.service} placeholder="Service" onChange={(e) => patch(i, { service: e.target.value })} />
                {prio(x, i)}
              </div>
              {timing(x, i)}
              <button className={styles.link} onClick={() => set(items.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          );
        })}
        <button className={styles.add} onClick={() => set([...items, { service: "", interval: "Annually", priority: "recommended" }])}>
          Add a service
        </button>
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
