"use client";
// The Job overview's optional sections, in its right-hand panel: Methodology,
// Variations, Findings, Maintenance plan and Warranty. Each group shows on its own page in the
// rail (data-pages), is off until switched on, and starts from a template
// that's then fully editable.

import { useState } from "react";
import styles from "../shared/OptionsPanel.module.css";
import ToggleRow from "../shared/ToggleRow";
import InfoTip from "@/components/reports/shared/builder/InfoTip";
import RichBox from "@/components/reports/shared/builder/RichBox";
import PlanServices, { seedPlan } from "@/components/reports/shared/builder/PlanServices";
import { htmlItems } from "@/lib/reports/richText";
import { emptyMethod, METHOD_TEMPLATES, methodFromDescription, methodIsEmpty } from "@/lib/reports/methodology";
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
import { FINDING_SIZES, FINDINGS_INTRO, VARIATIONS_INTRO, type ConditionReportData, type Finding, type Variation } from "@/lib/reports/condition.types";
import { formatHours } from "@/lib/reports/overview.layout";
import PhotoPickerModal from "@/components/reports/shared/builder/PhotoPickerModal";

type Patch = (fn: (prev: ConditionReportData) => ConditionReportData) => void;
export type ProjectSection = "method" | "variations" | "findings" | "plan" | "warranty";

/** A finding's or variation's photos: chosen in the picker, with how big
 *  they print. */
function ItemPhotos({
  report,
  item,
  label,
  onChange,
}: {
  report: ConditionReportData;
  item: Pick<Finding, "photoIds" | "size">;
  label: string;
  onChange: (p: Partial<Finding>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={styles.btn} onClick={() => setOpen(true)} disabled={!report.photos.length}>
        {item.photoIds.length ? `Photos · ${item.photoIds.length} chosen` : "Choose photos"}
      </button>
      {!report.photos.length && <span className={styles.subLabel}>Load the job&apos;s photos to choose some.</span>}
      {open && (
        <PhotoPickerModal
          multi
          title="Choose photos"
          subtitle={label}
          photos={report.photos.map((p) => ({ id: p.id, src: p.url, title: p.name }))}
          selected={item.photoIds}
          onPick={(id) => onChange({ photoIds: item.photoIds.includes(id) ? item.photoIds.filter((x) => x !== id) : [...item.photoIds, id] })}
          onClose={() => setOpen(false)}
        />
      )}
      {item.photoIds.length > 0 && (
        <>
          <span className={styles.subLabel}>
            Photo size <InfoTip>How many print to a row: small 4, medium 3, large 2, full width 1.</InfoTip>
          </span>
          <div className={styles.presetRow}>
            {FINDING_SIZES.map((z) => (
              <button
                key={z.key}
                className={`${styles.presetBtn} ${(item.size ?? "medium") === z.key ? styles.presetBtnActive : ""}`}
                onClick={() => onChange({ size: z.key })}
              >
                {z.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const newFinding = (): Finding => ({ id: `f${Date.now().toString(36)}`, title: "", desc: "", photoIds: [] });

const completedOf = (r: ConditionReportData) =>
  /^\d{4}-\d{2}-\d{2}$/.test(r.job.date) ? r.job.date : new Date().toISOString().slice(0, 10);

/** On or off; the first time on, each section starts from the job (the
 *  methodology from its description, the warranty kind it looks like) or a
 *  template. */
export function setSection(r: ConditionReportData, key: ProjectSection, on: boolean): ConditionReportData {
  if (key === "method")
    // From the job's description in SimPRO, never a made-up template (those
    // are only used when picked under "Start from"). Nothing to read yet:
    // empty, and filled in when the description arrives.
    return {
      ...r,
      method: {
        ...(r.method && !methodIsEmpty(r.method) ? r.method : (methodFromDescription(r.scope?.description) ?? r.method ?? emptyMethod())),
        on,
      },
    };
  if (key === "plan") return { ...r, plan: { ...(r.plan ?? { items: seedPlan(PROJECT_PLAN) }), on } };
  if (key === "variations") return { ...r, variations: { ...(r.variations ?? { intro: VARIATIONS_INTRO, items: [], showHours: true }), on } };
  if (key === "findings") return { ...r, findings: { ...(r.findings ?? { intro: FINDINGS_INTRO, items: [newFinding()] }), on } };
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
  // The last stage removed, for Undo.
  const [removedStage, setRemovedStage] = useState<{ g: { title: string; steps: string }; at: number } | null>(null);
  // The job's stages missing from the report (matched by title).
  const titleKey = (t: string) => t.trim().toLowerCase();
  const missing =
    fromJob && m ? fromJob.groups.map((g, at) => ({ g, at })).filter(({ g }) => !m.groups.some((x) => titleKey(x.title) === titleKey(g.title))) : [];
  const setMethod = (p: Partial<NonNullable<ConditionReportData["method"]>>) => update((r) => ({ ...r, method: { ...r.method!, ...p } }));
  const setKind = (kind: WarrantyKind, w: WarrantyInfo | undefined) =>
    update((r) => ({ ...r, warranty: { ...normWarranties(r.warranty, completedOf(r))!, [kind]: w } }));
  const toggle = (key: ProjectSection) => (v: boolean) => update((r) => setSection(r, key, v));
  // The methodology's photo picker is open.
  const [picking, setPicking] = useState<string | null>(null);
  const setFindings = (p: Partial<NonNullable<ConditionReportData["findings"]>>) => update((r) => ({ ...r, findings: { ...r.findings!, ...p } }));
  const setVariations = (p: Partial<NonNullable<ConditionReportData["variations"]>>) => update((r) => ({ ...r, variations: { ...r.variations!, ...p } }));
  const setVariation = (id: string, p: Partial<Variation>) =>
    update((r) => ({ ...r, variations: { ...r.variations!, items: r.variations!.items.map((v) => (v.id === id ? { ...v, ...p } : v)) } }));
  const setFinding = (id: string, p: Partial<Finding>) =>
    update((r) => ({ ...r, findings: { ...r.findings!, items: r.findings!.items.map((f) => (f.id === id ? { ...f, ...p } : f)) } }));

  return (
    <>
      {/* ── Methodology ─────────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="method">
        <ToggleRow label="Include a methodology" sub="How the works were carried out, step by step" checked={!!m?.on} onChange={toggle("method")} />
        {m?.on && (
          <>
            <label className={styles.field}>
              <span className={styles.subLabel}>
                Start from <InfoTip>Replaces the stages below. The job description is read from SimPRO: each bold heading becomes a stage, and its bullets or paragraphs the steps.</InfoTip>
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
            {/* The job's own stages that aren't in the report: add one back,
                or reload them all from the description. */}
            {fromJob && (
              <div className={styles.field}>
                {missing.length > 0 && (
                  <>
                    <span className={styles.subLabel}>From the job description, not in the report</span>
                    <div className={styles.presetRow}>
                      {missing.map(({ g, at }) => (
                        <button
                          key={at}
                          className={styles.presetBtn}
                          title="Add this stage back, from the job description"
                          onClick={() => {
                            const next = [...m.groups];
                            next.splice(Math.min(at, next.length), 0, g);
                            setMethod({ groups: next });
                          }}
                        >
                          + {g.title || `Stage ${at + 1}`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button
                  className={styles.textBtn}
                  onClick={() => {
                    if (!methodIsEmpty(m) && !confirm("Reload every stage from the job description in SimPRO? Changes to the stages here are replaced.")) return;
                    setMethod({ intro: fromJob.intro, groups: fromJob.groups });
                  }}
                >
                  Reload all stages from the job
                </button>
              </div>
            )}
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
                <button
                  className={styles.textBtn}
                  onClick={() => {
                    setRemovedStage({ g, at: i });
                    setMethod({ groups: m.groups.filter((_, j) => j !== i) });
                  }}
                >
                  Remove stage
                </button>
              </div>
            ))}
            {removedStage && (
              <span className={styles.subLabel}>
                Removed “{removedStage.g.title || `Stage ${removedStage.at + 1}`}”.{" "}
                <button
                  className={styles.textBtn}
                  onClick={() => {
                    const next = [...m.groups];
                    next.splice(Math.min(removedStage.at, next.length), 0, removedStage.g);
                    setMethod({ groups: next });
                    setRemovedStage(null);
                  }}
                >
                  Undo
                </button>
              </span>
            )}
            <button className={styles.addBtn} onClick={() => setMethod({ groups: [...m.groups, { title: "", steps: "" }] })}>
              Add a stage
            </button>
            <div className={styles.field} data-panel-field="methodCaption">
              <span className={styles.subLabel}>
                Photo <InfoTip>Optional, off unless you add one. Shown after the steps, full width, with its caption.</InfoTip>
              </span>
              {(() => {
                const photo = m.photoId ? report.photos.find((p) => p.id === m.photoId) : undefined;
                return photo ? (
                  <div className={styles.methodPhoto}>
                    <button className={styles.methodThumb} style={{ backgroundImage: `url("${photo.url}")` }} title="Change photo" onClick={() => setPicking("method")} />
                    <div className={styles.methodPhotoActs}>
                      <button className={styles.textBtn} onClick={() => setPicking("method")}>
                        Change photo
                      </button>
                      <button className={styles.textBtn} onClick={() => setMethod({ photoId: null, caption: "" })}>
                        No photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className={styles.btn} onClick={() => setPicking("method")} disabled={!report.photos.length}>
                    Add a photo
                  </button>
                );
              })()}
              {!report.photos.length && <span className={styles.subLabel}>Load the job&apos;s photos to choose one.</span>}
              {picking === "method" && (
                <PhotoPickerModal
                  title="Methodology photo"
                  subtitle="Shown after the steps, full width"
                  photos={report.photos.map((p) => ({ id: p.id, src: p.url, title: p.name }))}
                  selected={m.photoId ? [m.photoId] : []}
                  onPick={(id) => {
                    setMethod({ photoId: id });
                    setPicking(null);
                  }}
                  onClose={() => setPicking(null)}
                />
              )}
              {m.photoId && (
                <input className={styles.input} value={m.caption ?? ""} placeholder="Caption, e.g. Trafficable membrane during application." onChange={(e) => setMethod({ caption: e.target.value })} />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Variations ──────────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="variations">
        <ToggleRow
          label="Include variations"
          sub="Each variation cost centre in SimPRO, with its description, photos and hours"
          checked={!!report.variations?.on}
          onChange={toggle("variations")}
        />
        {report.variations?.on && (
          <>
            <label className={styles.field}>
              <span className={styles.subLabel}>Intro</span>
              <textarea className={styles.textarea} rows={2} value={report.variations.intro} onChange={(e) => setVariations({ intro: e.target.value })} />
            </label>
            <ToggleRow
              label="Show hours"
              sub="The labour hours logged to each variation in SimPRO"
              checked={report.variations.showHours !== false}
              onChange={(v) => setVariations({ showHours: v })}
            />
            {report.variations.items.length ? (
              report.variations.items.map((v, i) => (
                <div key={v.id} className={styles.field} style={v.off ? { opacity: 0.5 } : undefined}>
                  <span className={styles.subLabel}>
                    Variation {i + 1} · {v.hours > 0 ? `${formatHours(v.hours)} hours logged` : "no hours logged yet"}
                  </span>
                  {!v.off && (
                    <>
                      <input className={styles.input} value={v.title} placeholder="Variation title" onChange={(e) => setVariation(v.id, { title: e.target.value })} />
                      <RichBox value={v.desc} placeholder="What was added to the scope, and why" onChange={(desc) => setVariation(v.id, { desc })} />
                      <ItemPhotos report={report} item={v} label={v.title || `Variation ${i + 1}`} onChange={(p) => setVariation(v.id, p)} />
                    </>
                  )}
                  <button className={styles.textBtn} onClick={() => setVariation(v.id, { off: !v.off })}>
                    {v.off ? `Include “${v.title || `Variation ${i + 1}`}”` : "Leave off the report"}
                  </button>
                </div>
              ))
            ) : (
              <span className={styles.subLabel}>No variation cost centres on this job in SimPRO.</span>
            )}
          </>
        )}
      </div>

      {/* ── Findings ────────────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="findings">
        <ToggleRow
          label="Include findings"
          sub="What our team found on site, with photos, suggesting additional works"
          checked={!!report.findings?.on}
          onChange={toggle("findings")}
        />
        {report.findings?.on && (
          <>
            <label className={styles.field}>
              <span className={styles.subLabel}>Intro</span>
              <textarea
                className={styles.textarea}
                rows={3}
                value={report.findings.intro}
                onChange={(e) => setFindings({ intro: e.target.value })}
              />
            </label>
            {report.findings.items.map((f, i) => (
              <div key={f.id} className={styles.field}>
                <span className={styles.subLabel}>Finding {i + 1}</span>
                <input
                  className={styles.input}
                  value={f.title}
                  placeholder="e.g. Cracked render, north wall level 2"
                  onChange={(e) => setFinding(f.id, { title: e.target.value })}
                />
                <RichBox
                  value={f.desc}
                  placeholder="What we found, and the work we'd recommend"
                  onChange={(desc) => setFinding(f.id, { desc })}
                />
                <ItemPhotos report={report} item={f} label={f.title || `Finding ${i + 1}`} onChange={(p) => setFinding(f.id, p)} />
                <button
                  className={styles.textBtn}
                  onClick={() => setFindings({ items: report.findings!.items.filter((x) => x.id !== f.id) })}
                >
                  Remove finding
                </button>
              </div>
            ))}
            <button className={styles.addBtn} onClick={() => setFindings({ items: [...report.findings!.items, newFinding()] })}>
              Add a finding
            </button>
          </>
        )}
      </div>

      {/* ── Maintenance plan ────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="plan">
        <ToggleRow label="Include recommended works" sub="Services, how often, and what's required" checked={!!report.plan?.on} onChange={toggle("plan")} />
        {report.plan?.on && <PlanServices presets={PROJECT_PLAN} plan={report.plan} onPlan={(plan) => update((r) => ({ ...r, plan: { ...plan, on: true } }))} />}
        {report.plan?.on && (
          <ToggleRow
            label="End with Also worth adding"
            sub="Our other services, Request a quote and who to call, after the recommended works"
            checked={report.plan.ending !== false}
            onChange={(v) => update((r) => ({ ...r, plan: { ...r.plan!, ending: v } }))}
          />
        )}
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
