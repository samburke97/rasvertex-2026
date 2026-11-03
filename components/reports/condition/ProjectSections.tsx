"use client";
// The Job overview's optional sections, in its right-hand panel: Methodology,
// Maintenance plan and Warranty. Each group shows on its own page in the
// rail (data-pages), is off until switched on, and starts from a template
// that's then fully editable.

import styles from "../shared/OptionsPanel.module.css";
import ToggleRow from "../shared/ToggleRow";
import InfoTip from "@/components/reports/shared/builder/InfoTip";
import RichBox from "@/components/reports/shared/builder/RichBox";
import PlanServices, { seedPlan } from "@/components/reports/shared/builder/PlanServices";
import { htmlItems } from "@/lib/reports/richText";
import { METHOD_TEMPLATES, methodFromDescription } from "@/lib/reports/methodology";
import { PROJECT_PLAN } from "@/lib/reports/maintenancePlan";
import {
  defaultRequirements,
  defaultSchedule,
  guessKind,
  isMissing,
  KIND,
  newWarranty,
  normWarranties,
  SUPPLIERS,
  WARRANTY_KINDS,
  type SupplierKey,
  type WarrantyInfo,
  type WarrantyKind,
  type WarrantyScheduleRow,
} from "@/lib/reports/warranty";
import type { ConditionReportData } from "@/lib/reports/condition.types";

type Patch = (fn: (prev: ConditionReportData) => ConditionReportData) => void;
export type ProjectSection = "method" | "plan" | "warranty";

const completedOf = (r: ConditionReportData) =>
  /^\d{4}-\d{2}-\d{2}$/.test(r.job.date) ? r.job.date : new Date().toISOString().slice(0, 10);

/** On or off; the first time on, each section starts from the job (the
 *  methodology from its description, the warranty kind it looks like) or a
 *  template. */
export function setSection(r: ConditionReportData, key: ProjectSection, on: boolean): ConditionReportData {
  if (key === "method")
    return { ...r, method: { ...(r.method ?? methodFromDescription(r.scope?.description) ?? METHOD_TEMPLATES.waterproofing.method), on } };
  if (key === "plan") return { ...r, plan: { ...(r.plan ?? { items: seedPlan(PROJECT_PLAN) }), on } };
  const ws = normWarranties(r.warranty, completedOf(r));
  if (ws) return { ...r, warranty: { ...ws, on } };
  const kind = guessKind(r.scope?.description);
  return { ...r, warranty: { on, [kind]: newWarranty(kind, completedOf(r)) } };
}

export const sectionOn = (r: ConditionReportData, key: ProjectSection) => !!r[key]?.on;

const listHtml = (items: string[]) => `<ul>${items.map((t) => `<li><p>${t}</p></li>`).join("")}</ul>`;

export default function ProjectSections({ report, update }: { report: ConditionReportData; update: Patch }) {
  const m = report.method;
  const ws = normWarranties(report.warranty, completedOf(report));
  const fromJob = methodFromDescription(report.scope?.description);
  const setMethod = (p: Partial<NonNullable<ConditionReportData["method"]>>) => update((r) => ({ ...r, method: { ...r.method!, ...p } }));
  const setKind = (kind: WarrantyKind, w: WarrantyInfo | undefined) =>
    update((r) => ({ ...r, warranty: { ...normWarranties(r.warranty, completedOf(r))!, [kind]: w } }));
  const toggle = (key: ProjectSection) => (v: boolean) => update((r) => setSection(r, key, v));

  return (
    <>
      {/* ── Methodology ─────────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="method">
        <ToggleRow label="Include a methodology" sub="How the works were carried out, step by step" checked={!!m?.on} onChange={toggle("method")} />
        {m?.on && (
          <>
            <label className={styles.field}>
              <span className={styles.subLabel}>
                Start from <InfoTip>Replaces the stages below. The job description is read from SimPRO: each bold heading becomes a stage and its bullets the steps.</InfoTip>
              </span>
              <select
                className={styles.input}
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "job" && fromJob) setMethod(fromJob);
                  else if (v) setMethod({ ...METHOD_TEMPLATES[v as keyof typeof METHOD_TEMPLATES].method });
                }}
              >
                <option value="">Choose…</option>
                {fromJob && <option value="job">From the job description</option>}
                {Object.entries(METHOD_TEMPLATES).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field} data-panel-field="methodIntro">
              <span className={styles.subLabel}>Intro</span>
              <textarea className={styles.textarea} rows={2} value={m.intro} onChange={(e) => setMethod({ intro: e.target.value })} />
            </label>
            {m.groups.map((g, i) => (
              <div key={i} className={styles.field}>
                <span className={styles.subLabel}>Stage {i + 1}</span>
                <input
                  className={styles.input}
                  value={g.title}
                  placeholder="e.g. Substrate preparation"
                  onChange={(e) => setMethod({ groups: m.groups.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                />
                <RichBox list value={g.steps} placeholder="One step per line" onChange={(steps) => setMethod({ groups: m.groups.map((x, j) => (j === i ? { ...x, steps } : x)) })} />
                <button className={styles.textBtn} onClick={() => setMethod({ groups: m.groups.filter((_, j) => j !== i) })}>
                  Remove stage
                </button>
              </div>
            ))}
            <button className={styles.addBtn} onClick={() => setMethod({ groups: [...m.groups, { title: "", steps: "" }] })}>
              Add a stage
            </button>
            <div className={styles.field} data-panel-field="methodCaption">
              <span className={styles.subLabel}>
                Photo <InfoTip>Optional. Shown after the steps, full width, with its caption.</InfoTip>
              </span>
              <div className={styles.methodThumbs}>
                {report.photos.slice(0, 60).map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.methodThumb} ${m.photoId === p.id ? styles.methodThumbOn : ""}`}
                    style={{ backgroundImage: `url("${p.url}")` }}
                    title={p.name}
                    onClick={() => setMethod({ photoId: m.photoId === p.id ? null : p.id })}
                  />
                ))}
              </div>
              {!report.photos.length && <span className={styles.subLabel}>Load the job&apos;s photos to choose one.</span>}
              {m.photoId && (
                <input className={styles.input} value={m.caption ?? ""} placeholder="Caption, e.g. Trafficable membrane during application." onChange={(e) => setMethod({ caption: e.target.value })} />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Maintenance plan ────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="plan">
        <ToggleRow label="Include a maintenance plan" sub="Services, how often, and what's required" checked={!!report.plan?.on} onChange={toggle("plan")} />
        {report.plan?.on && <PlanServices presets={PROJECT_PLAN} plan={report.plan} onPlan={(plan) => update((r) => ({ ...r, plan: { ...plan, on: true } }))} />}
      </div>

      {/* ── Warranty ────────────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="warranty">
        <ToggleRow label="Include warranties" sub="Waterproofing and painting, and what keeps them valid" checked={!!ws?.on} onChange={toggle("warranty")} />
        {ws?.on &&
          WARRANTY_KINDS.map((kind) => (
            <div key={kind} className={styles.kindCard}>
              <ToggleRow
                label={KIND[kind].title}
                sub={kind === "waterproofing" ? "Installation, obligations and inspections" : "Applicator's warranty, owner obligations and washes"}
                checked={!!ws[kind]?.on}
                onChange={(v) => setKind(kind, ws[kind] ? { ...ws[kind]!, on: v } : v ? newWarranty(kind, completedOf(report)) : undefined)}
              />
              {ws[kind]?.on && <KindEditor kind={kind} w={ws[kind]!} onChange={(w) => setKind(kind, w)} />}
            </div>
          ))}
      </div>
    </>
  );
}

/** One warranty's fields. Changing the years rewrites the schedule and the
 *  obligations that mention them. */
function KindEditor({ kind, w, onChange }: { kind: WarrantyKind; w: WarrantyInfo; onChange: (w: WarrantyInfo) => void }) {
  const set = (p: Partial<WarrantyInfo>) => onChange({ ...w, ...p });
  const f = (name: string) => `${kind}.${name}`;
  const setRow = (i: number, p: Partial<WarrantyScheduleRow>) => set({ schedule: w.schedule.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const suppliers = (Object.keys(SUPPLIERS) as SupplierKey[]).filter((k) => SUPPLIERS[k].kinds.includes(kind));
  // Required before saving or downloading: a red edge until filled.
  const req = (key: "area" | "products" | "completed") => `${styles.input} ${isMissing(w, key) ? styles.inputMissing : ""}`;
  return (
    <>
      <label className={styles.field} data-panel-field={f("supplier")}>
        <span className={styles.subLabel}>
          Manufacturer <InfoTip>Printed as the manufacturer of the products applied. The warranty itself is RAS-VERTEX&apos;s, on the workmanship.</InfoTip>
        </span>
        <select className={styles.input} value={w.supplier} onChange={(e) => set({ supplier: e.target.value as SupplierKey })}>
          {suppliers.map((k) => (
            <option key={k} value={k}>
              {SUPPLIERS[k].name}
            </option>
          ))}
        </select>
      </label>
      {w.supplier === "other" && (
        <label className={styles.field}>
          <span className={styles.subLabel}>Manufacturer name</span>
          <input className={styles.input} value={w.supplierName ?? ""} placeholder="Leave blank to print none" onChange={(e) => set({ supplierName: e.target.value })} />
        </label>
      )}
      <div className={styles.warrantyRow}>
        <label className={styles.field} data-panel-field={f("completed")}>
          <span className={styles.subLabel}>Completed *</span>
          <input className={req("completed")} type="date" value={w.completed} onChange={(e) => set({ completed: e.target.value })} />
        </label>
        <label className={styles.field} data-panel-field={f("years")}>
          <span className={styles.subLabel}>Warranty (years)</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={30}
            value={w.years}
            onChange={(e) => {
              const years = Math.max(1, Number(e.target.value) || 1);
              // Only rewrite what still reads as generated.
              const sameReq = JSON.stringify(w.requirements) === JSON.stringify(defaultRequirements(kind, w.years));
              const sameSched = JSON.stringify(w.schedule) === JSON.stringify(defaultSchedule(kind, w.years));
              set({
                years,
                ...(sameReq && { requirements: defaultRequirements(kind, years) }),
                ...(sameSched && { schedule: defaultSchedule(kind, years) }),
              });
            }}
          />
        </label>
      </div>
      <label className={styles.field} data-panel-field={f("area")}>
        <span className={styles.subLabel}>Area of works *</span>
        <input className={req("area")} value={w.area} placeholder={kind === "painting" ? "e.g. External" : "e.g. Roof"} onChange={(e) => set({ area: e.target.value })} />
      </label>
      <label className={styles.field} data-panel-field={f("products")}>
        <span className={styles.subLabel}>Products applied *</span>
        <input className={req("products")} value={w.products} placeholder="e.g. Everflex VBS, Everflex WPUV" onChange={(e) => set({ products: e.target.value })} />
      </label>
      <label className={styles.field} data-panel-field={f("intro")}>
        <span className={styles.subLabel}>
          Warranty <InfoTip>Left blank, the standard wording for {kind} is used, with the years and completion date above.</InfoTip>
        </span>
        <textarea className={styles.textarea} rows={3} value={w.intro ?? ""} placeholder="Standard wording" onChange={(e) => set({ intro: e.target.value || undefined })} />
      </label>
      <label className={styles.field} data-panel-field={f("statement")}>
        <span className={styles.subLabel}>
          Declaration <InfoTip>Signed by Phil Clark. Left blank, the standard declaration is used.</InfoTip>
        </span>
        <textarea className={styles.textarea} rows={3} value={w.statement ?? ""} placeholder="Standard declaration" onChange={(e) => set({ statement: e.target.value || undefined })} />
      </label>
      <label className={styles.field} data-panel-field={f("signed")}>
        <span className={styles.subLabel}>Signed on</span>
        <input className={styles.input} type="date" value={w.signed ?? ""} onChange={(e) => set({ signed: e.target.value || undefined })} />
      </label>
      <div className={styles.field} data-panel-field={f("requirements")}>
        <span className={styles.subLabel}>
          {KIND[kind].obligations} <InfoTip>What the owner must do to keep the warranty valid, one per line.</InfoTip>
        </span>
        <RichBox list value={listHtml(w.requirements)} placeholder="One per line" onChange={(html) => set({ requirements: htmlItems(html) })} />
      </div>
      <div className={styles.field} data-panel-field={f("schedule")}>
        <span className={styles.subLabel}>{KIND[kind].scheduleTitle}</span>
        {w.schedule.map((x, i) => (
          <div key={i} className={styles.scheduleRow}>
            <input className={styles.input} value={x.when} placeholder="Interval" onChange={(e) => setRow(i, { when: e.target.value })} />
            <input className={styles.input} value={x.inspection} placeholder={kind === "painting" ? "Service" : "Inspection"} onChange={(e) => setRow(i, { inspection: e.target.value })} />
            <textarea className={styles.textarea} rows={3} value={x.notes} placeholder="Notes" onChange={(e) => setRow(i, { notes: e.target.value })} />
            <button className={styles.textBtn} onClick={() => set({ schedule: w.schedule.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button className={styles.addBtn} onClick={() => set({ schedule: [...w.schedule, { when: "", inspection: "", notes: "" }] })}>
          {kind === "painting" ? "Add a service" : "Add an inspection"}
        </button>
      </div>
    </>
  );
}
