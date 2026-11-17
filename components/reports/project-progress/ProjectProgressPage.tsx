"use client";
// components/reports/project-progress/ProjectProgressPage.tsx
//
// Project progress builder: job numbers and their wording, status and price
// on the left; the report on the right (ProgressDocument, scaled to fit).
// Each job is read from SimPRO (price ex GST, labour hours, stage); the rep
// can override the wording, status and price, or leave a job off. Drafts
// autosave under the first job's number, so reopening that job resumes it.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import shell from "../shared/ReportPage.module.css";
import panel from "../shared/OptionsPanel.module.css";
import styles from "./ProjectProgressPage.module.css";
import ToggleRow from "../shared/ToggleRow";
import DatePicker from "@/components/ui/DatePicker";
import SaveReportModal, { postSave } from "../shared/SaveReportModal";
import BuilderHeader, { HeaderButton } from "@/components/reports/shared/builder/BuilderHeader";
import { useDraftAutosave } from "@/components/reports/shared/builder/useDraftAutosave";
import { useHistory } from "@/components/reports/shared/builder/useHistory";
import { OverviewStyles } from "../condition/OverviewDocument";
import ProgressDocument, { PROGRESS_CSS } from "./ProgressDocument";
import { PAGE_W } from "@/lib/reports/overview.layout";
import {
  buildProgressModel,
  hoursText,
  isProgressReport,
  money,
  newReport,
  shownRow,
  STATE_LABEL,
  type JobState,
  type ProgressJob,
  type ProgressReport,
  type ProgressRow,
} from "@/lib/reports/projectProgress";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** A job's cost centres (original scope, then variations) from SimPRO. */
async function readJob(id: string): Promise<ProgressJob[]> {
  const res = await fetch(`/api/reports/project-progress/job/${id}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Couldn't read job ${id}`);
  return body.items as ProgressJob[];
}

/** SimPRO's latest for rows already on the report, job by job. */
async function freshen(rows: ProgressRow[]): Promise<ProgressRow[]> {
  const jobs = [...new Set(rows.map((r) => r.simpro.jobId))];
  const got = await Promise.all(jobs.map((j) => readJob(j).catch(() => [] as ProgressJob[])));
  const by = new Map(got.flat().map((it) => [it.id, it]));
  return rows.map((r) => ({ ...r, simpro: by.get(r.id) ?? r.simpro }));
}

export default function ProjectProgressPage({ onBack }: { onBack: () => void }) {
  const [report, setReportState, history] = useHistory<ProgressReport>(() => newReport(today()));
  const [touched, setTouched] = useState(false);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const setReport = useCallback((fn: (r: ProgressReport) => ProgressReport) => {
    setReportState(fn);
    setTouched(true);
  }, []);
  const mainId = report.rows[0]?.simpro.jobId ?? null;
  const { status: saveStatus } = useDraftAutosave(mainId ? `/api/reports/project-progress/${mainId}` : null, report, {
    ready: touched && !!mainId,
  });

  const model = useMemo(() => buildProgressModel(report), [report]);

  // ── Adding jobs ──────────────────────────────────────────────────────────
  const addJobs = async (ids: string[]) => {
    const fresh = ids.filter((id) => !report.rows.some((r) => r.simpro.jobId === id));
    if (!fresh.length) return;
    setBusy(true);
    setError(null);
    try {
      // The first job of a new report: resume its saved draft, if any.
      if (!report.rows.length) {
        const res = await fetch(`/api/reports/project-progress/${fresh[0]}`);
        const draft = res.ok ? (await res.json()).report : null;
        if (isProgressReport(draft) && draft.rows.length) {
          const rows = await freshen(draft.rows);
          // A resumed draft starts its own undo history.
          history.reset({ ...draft, rows });
          fresh.shift();
          if (!fresh.length) return;
        }
      }
      const rows: ProgressRow[] = [];
      const failed: string[] = [];
      for (const id of fresh) {
        try {
          for (const it of await readJob(id)) rows.push({ id: it.id, simpro: it });
        } catch (e) {
          failed.push(e instanceof Error ? e.message : id);
        }
      }
      if (rows.length) setReport((r) => ({ ...r, rows: [...r.rows, ...rows.filter((x) => !r.rows.some((y) => y.id === x.id))] }));
      if (failed.length) setError(failed.join(". "));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const ids = [...new Set(entry.split(/[\s,;#]+/).map((s) => s.trim()).filter((s) => /^\d{3,8}$/.test(s)))];
    if (!ids.length) {
      setError("Enter one or more job numbers, e.g. 11321, 11389");
      return;
    }
    setEntry("");
    addJobs(ids);
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const rows = await freshen(report.rows);
      setReport((r) => ({ ...r, rows: r.rows.map((row) => rows.find((x) => x.id === row.id) ?? row) }));
    } finally {
      setBusy(false);
    }
  };

  const setRow = (id: string, patch: Partial<ProgressRow>) =>
    setReport((r) => ({ ...r, rows: r.rows.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const removeRow = (id: string) => setReport((r) => ({ ...r, rows: r.rows.filter((x) => x.id !== id) }));

  // ── Preview zoom (1280-wide pages) ───────────────────────────────────────
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => {
      const z = Math.max(0.15, Math.min(0.75, (el.clientWidth - 64) / PAGE_W));
      setZoom((prev) => (Math.abs(prev - z) > 0.003 ? z : prev));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Export ───────────────────────────────────────────────────────────────
  const filename = `Project Progress ${model.title}${mainId ? ` ${mainId}` : ""}`.replace(/[\\/:*?"<>|]/g, "");
  const downloadPDF = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/reports/project-progress/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, report }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Export failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  const hasJobs = model.jobs > 0;

  return (
    <div className={shell.page}>
      <BuilderHeader
        history={history}
        onBack={onBack}
        title="Project progress"
        subtitle={hasJobs ? model.title : undefined}
        badges={hasJobs ? [`${model.jobs} job${model.jobs === 1 ? "" : "s"}`, `${money(model.completed)} completed`] : undefined}
        status={busy ? { text: "Reading SimPRO…", busy: true } : saved ? { text: "Saved to SimPRO" } : touched && mainId ? saveStatus : undefined}
      >
        <HeaderButton onClick={downloadPDF} disabled={!hasJobs || exporting}>
          {exporting ? "Exporting…" : "Download PDF"}
        </HeaderButton>
        <HeaderButton primary onClick={() => setSaving(true)} disabled={!hasJobs || !mainId}>
          Save to SimPRO
        </HeaderButton>
      </BuilderHeader>

      <div className={shell.editorBody}>
        <aside className={panel.panel}>
          {/* ── Jobs ── */}
          <div className={panel.group}>
            <div className={panel.groupLabelRow}>
              <span className={panel.groupLabel}>Jobs</span>
              {report.rows.length > 0 && <span className={panel.subLabel}>{report.rows.length}</span>}
            </div>
            <p className={panel.subLabel}>
              Each job comes in with its original scope and every variation on it. Several at once is fine: 11295, 11321.
            </p>
            <form
              className={styles.addRow}
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                className={`${panel.input} ${styles.addInput}`}
                value={entry}
                placeholder="Job numbers, e.g. 11295"
                onChange={(e) => setEntry(e.target.value)}
                inputMode="numeric"
                autoFocus
              />
              <button className={`${panel.btn} ${panel.btnPrimary} ${styles.addBtn}`} disabled={busy || !entry.trim()}>
                {busy ? "Adding…" : "Add"}
              </button>
            </form>
            {error && <p className={styles.error}>{error}</p>}

            {report.rows.map((r, i) => {
              const s = shownRow(r);
              const isOpen = open === r.id;
              return (
                <div key={r.id} className={`${styles.job} ${r.hidden ? styles.jobOff : ""}`}>
                  <button className={styles.jobHead} onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                    <span className={styles.jobNo}>#{r.simpro.jobId}</span>
                    <span className={styles.jobName}>
                      {s.work}
                      <small>
                        {r.simpro.isVariation ? "Variation · " : i === 0 ? "Original scope · " : ""}
                        {STATE_LABEL[s.state]} · {hoursText(s.hours)} h · {money(s.price)}
                      </small>
                    </span>
                    <span className={styles.chev} data-open={isOpen} />
                  </button>
                  {isOpen && (
                    <div className={styles.jobBody}>
                      <label className={panel.field}>
                        <span className={panel.dateFieldLabel}>Work</span>
                        <input className={panel.input} value={s.work} onChange={(e) => setRow(r.id, { work: e.target.value })} />
                      </label>
                      <div className={styles.two}>
                        <label className={panel.field}>
                          <span className={panel.dateFieldLabel}>Status</span>
                          <select className={panel.input} value={s.state} onChange={(e) => setRow(r.id, { state: e.target.value as JobState })}>
                            {(Object.keys(STATE_LABEL) as JobState[]).map((k) => (
                              <option key={k} value={k}>
                                {STATE_LABEL[k]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={panel.field}>
                          <span className={panel.dateFieldLabel}>Price ex GST</span>
                          <input
                            className={panel.input}
                            inputMode="decimal"
                            value={r.price ?? r.simpro.priceExTax}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value.replace(/[$,\s]/g, ""));
                              setRow(r.id, { price: Number.isFinite(v) ? v : 0 });
                            }}
                          />
                        </label>
                      </div>
                      <p className={panel.subLabel}>
                        SimPRO: cost centre {r.id} · {r.simpro.stage} · {hoursText(r.simpro.hoursUsed)} of {hoursText(r.simpro.hoursEstimate)} h ·{" "}
                        {money(r.simpro.priceExTax)} ex GST{r.simpro.priceFromHours ? " (hours × rate, no set price)" : ""}
                      </p>
                      <div className={styles.jobActions}>
                        <ToggleRow label="Show on the report" checked={!r.hidden} onChange={(v) => setRow(r.id, { hidden: !v })} />
                        {(r.work != null || r.state != null || r.price != null) && (
                          <button className={styles.textBtn} onClick={() => setRow(r.id, { work: undefined, state: undefined, price: undefined })}>
                            Back to SimPRO&apos;s
                          </button>
                        )}
                        <button className={`${styles.textBtn} ${styles.danger}`} onClick={() => removeRow(r.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {report.rows.length > 0 && (
              <button className={panel.btn} onClick={refresh} disabled={busy}>
                {busy ? "Reading SimPRO…" : "Refresh from SimPRO"}
              </button>
            )}
          </div>

          {/* ── Report ── */}
          {report.rows.length > 0 && (
            <div className={panel.group}>
              <div className={panel.groupLabel}>Report</div>
              <label className={panel.field}>
                <span className={panel.dateFieldLabel}>Project</span>
                <input
                  className={panel.input}
                  value={report.title ?? ""}
                  placeholder={model.title}
                  onChange={(e) => setReport((r) => ({ ...r, title: e.target.value || undefined }))}
                />
              </label>
              <div className={panel.dateField}>
                <label className={panel.dateFieldLabel}>As at</label>
                <DatePicker value={report.asAt} onChange={(v) => v && setReport((r) => ({ ...r, asAt: v }))} />
              </div>
              <label className={panel.field}>
                <span className={panel.dateFieldLabel}>Intro</span>
                <textarea className={panel.textarea} rows={3} value={report.intro} onChange={(e) => setReport((r) => ({ ...r, intro: e.target.value }))} />
              </label>
              <ToggleRow
                label="Estimated hours"
                sub="“136 of 240” rather than just the hours used"
                checked={report.showEstimate}
                onChange={(v) => setReport((r) => ({ ...r, showEstimate: v }))}
              />
            </div>
          )}
        </aside>

        <div ref={previewRef} className={shell.canvas}>
          <OverviewStyles />
          <style dangerouslySetInnerHTML={{ __html: PROGRESS_CSS }} />
          {hasJobs ? (
            <div style={{ zoom }}>
              <ProgressDocument model={model} screen />
            </div>
          ) : (
            <div className={shell.pageLabel}>{busy ? "Reading SimPRO…" : "Add the project's job numbers to start."}</div>
          )}
        </div>
      </div>

      {saving && mainId && (
        <SaveReportModal
          owner={{ kind: "Job", no: `#${mainId}` }}
          siteId={report.rows[0]?.simpro.siteId || undefined}
          defaultFilename={filename}
          save={(name, d) =>
            postSave(`/api/simpro/jobs/${mainId}/save-progress-report`, {
              filename: name,
              companyId: 0,
              siteId: report.rows[0]?.simpro.siteId,
              destinations: { job: d.owner, site: d.site },
              report,
            })
          }
          onClose={() => setSaving(false)}
          onSuccess={(name) => {
            setSaved(name);
            setSaving(false);
          }}
        />
      )}
    </div>
  );
}
