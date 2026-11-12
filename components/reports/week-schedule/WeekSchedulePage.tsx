"use client";
// components/reports/week-schedule/WeekSchedulePage.tsx
//
// Weekly schedule builder: the week and display options on the left, the
// landscape pages on the right (WeekScheduleDocument, scaled to fit), in
// the same shell as the other report builders. Read-only: SimPRO is the
// source of truth. "Copy for Excel" puts the table on the clipboard for the
// weekly spreadsheet; "Download PDF" renders the same pages on the server.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import shell from "../shared/ReportPage.module.css";
import panel from "../shared/OptionsPanel.module.css";
import styles from "./WeekSchedulePage.module.css";
import ToggleRow from "../shared/ToggleRow";
import BuilderHeader, { HeaderButton } from "@/components/reports/shared/builder/BuilderHeader";
import WeekScheduleDocument, { WEEK_CSS } from "./WeekScheduleDocument";
import { ANCHOR_IMAGES } from "@/lib/reports/anchor.layout";
import {
  addDays,
  buildWeekModel,
  DEFAULT_WEEK_OPTIONS,
  iso,
  mondayOf,
  refText,
  weekDays,
  weekTitle,
  WEEK_PAGE_W,
  type WeekOptions,
  type WeekScheduleResponse,
} from "@/lib/reports/weekSchedule";

interface Props {
  onBack: () => void;
}

type Load =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; data: WeekScheduleResponse };

const LOGO = "/" + ANCHOR_IMAGES.logo;

// Per-viewer conveniences (hidden team members, display options): browser
// storage, best effort.
const HIDDEN_KEY = "week-schedule:hidden";
const OPTS_KEY = "week-schedule:opts";
function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private window etc. */
  }
}

const EMPTY: WeekScheduleResponse = { from: "", to: "", staff: [], entries: [], skipped: 0 };

export default function WeekSchedulePage({ onBack }: Props) {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [hidden, setHidden] = useState<number[]>([]);
  const [opts, setOpts] = useState<WeekOptions>(DEFAULT_WEEK_OPTIONS);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setHidden(readJSON<number[]>(HIDDEN_KEY, []));
    setOpts({ ...DEFAULT_WEEK_OPTIONS, ...readJSON<Partial<WeekOptions>>(OPTS_KEY, {}) });
  }, []);
  const setOpt = (k: keyof WeekOptions, v: boolean) =>
    setOpts((o) => {
      const n = { ...o, [k]: v };
      writeJSON(OPTS_KEY, n);
      return n;
    });
  const setShown = (id: number, shown: boolean) =>
    setHidden((h) => {
      const n = shown ? h.filter((x) => x !== id) : [...h.filter((x) => x !== id), id];
      writeJSON(HIDDEN_KEY, n);
      return n;
    });

  const days = useMemo(() => weekDays(monday), [monday]);
  useEffect(() => {
    let live = true;
    setLoad({ phase: "loading" });
    fetch(`/api/simpro/schedules/week?from=${days[0]}&to=${days[6]}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        return body as WeekScheduleResponse;
      })
      .then((data) => live && setLoad({ phase: "done", data }))
      .catch((err) => live && setLoad({ phase: "error", message: err instanceof Error ? err.message : String(err) }));
    return () => {
      live = false;
    };
  }, [days, reloadKey]);

  const data = load.phase === "done" ? load.data : null;
  const model = useMemo(() => buildWeekModel(data ?? EMPTY, monday, opts, hidden), [data, monday, opts, hidden]);
  const weekendBooked = !!data?.entries.some((e) => e.date === days[5] || e.date === days[6]);
  const ready = !!data && model.staffCount > 0;

  // The pages are 1810 wide, scaled to the column.
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => {
      const z = Math.max(0.15, Math.min(0.8, (el.clientWidth - 64) / WEEK_PAGE_W));
      setZoom((prev) => (Math.abs(prev - z) > 0.003 ? z : prev));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Copy for Excel ───────────────────────────────────────────────────────
  const copyForExcel = useCallback(async () => {
    const rows = model.pages.flat();
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const text = (it: { label: string; refs: string[] }) =>
      opts.refs && it.refs.length ? `${it.label} (${refText(it.refs)})` : it.label;
    const td = "border:1px solid #c7cfdc;padding:4px 10px;text-align:center;font-family:Calibri,Arial;font-size:11pt;color:#011955;";
    const head = "background:#011955;color:#ffffff;font-weight:bold;";
    const sub = "background:#deeeff;font-weight:bold;";
    const html =
      `<table style="border-collapse:collapse">` +
      `<tr><td style="${td}${head}"></td><td style="${td}${head}"></td>${model.days.map((d) => `<td style="${td}${head}">${d.date}</td>`).join("")}</tr>` +
      `<tr><td style="${td}${sub}"></td><td style="${td}${sub}text-align:left">Name</td>${model.days.map((d) => `<td style="${td}${sub}">${d.day}</td>`).join("")}</tr>` +
      rows
        .map(
          (r) =>
            `<tr><td style="${td}">${r.n}</td><td style="${td}text-align:left">${esc(r.name)}</td>` +
            r.cells
              .map((items) => {
                const bg = items[0]?.tone ? `background:${items[0].tone};` : "";
                return `<td style="${td}${bg}">${items.map((it) => esc(text(it))).join("<br>")}</td>`;
              })
              .join("") +
            `</tr>`,
        )
        .join("") +
      `</table>`;
    const tsv = [
      ["", "", ...model.days.map((d) => d.date)].join("\t"),
      ["", "Name", ...model.days.map((d) => d.day)].join("\t"),
      ...rows.map((r) => [String(r.n), r.name, ...r.cells.map((items) => items.map(text).join(" / "))].join("\t")),
    ].join("\n");
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([tsv], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }, [model, opts.refs]);

  // ── Download PDF ─────────────────────────────────────────────────────────
  const downloadPDF = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    const filename = `Weekly Schedule ${days[0]}`;
    try {
      const res = await fetch("/api/reports/export-week-schedule-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, monday: iso(monday), data, opts, hidden }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ExportWeekSchedulePDF]", err);
      alert(err instanceof Error ? err.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [data, days, monday, opts, hidden]);

  const thisMonday = mondayOf(new Date());
  const presets = [
    { label: "This week", monday: thisMonday },
    { label: "Next week", monday: addDays(thisMonday, 7) },
  ];

  return (
    <div className={shell.page}>
      <style dangerouslySetInnerHTML={{ __html: WEEK_CSS }} />
      <BuilderHeader
        onBack={onBack}
        title="Weekly schedule"
        subtitle={weekTitle(monday)}
        badges={data ? [`${model.staffCount} team`, `${model.siteCount} site${model.siteCount === 1 ? "" : "s"}`] : undefined}
        status={
          load.phase === "loading"
            ? { text: "Reading SimPRO…", busy: true }
            : copied === "ok"
              ? { text: "Copied. Paste into Excel" }
              : copied === "fail"
                ? { text: "Couldn't copy", busy: true }
                : undefined
        }
      >
        <HeaderButton onClick={copyForExcel} disabled={!ready}>
          Copy for Excel
        </HeaderButton>
        <HeaderButton primary onClick={downloadPDF} disabled={!ready || exporting}>
          {exporting ? "Exporting…" : "Download PDF"}
        </HeaderButton>
      </BuilderHeader>

      <div className={shell.editorBody}>
        <aside className={panel.panel}>
          {/* ── Week ── */}
          <div className={panel.group}>
            <div className={panel.groupLabel}>Week</div>
            <div className={styles.weekNav}>
              <button className={styles.navBtn} onClick={() => setMonday((m) => addDays(m, -7))} aria-label="Previous week">
                <Chevron left />
              </button>
              <span className={styles.weekLabel}>{weekTitle(monday)}</span>
              <button className={styles.navBtn} onClick={() => setMonday((m) => addDays(m, 7))} aria-label="Next week">
                <Chevron />
              </button>
            </div>
            <div className={panel.presetRow}>
              {presets.map((p) => (
                <button
                  key={p.label}
                  className={`${panel.presetBtn} ${iso(p.monday) === iso(monday) ? panel.presetBtnActive : ""}`}
                  onClick={() => setMonday(p.monday)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button className={panel.btn} onClick={() => setReloadKey((k) => k + 1)} disabled={load.phase === "loading"}>
              {load.phase === "loading" ? "Reading SimPRO…" : "Refresh from SimPRO"}
            </button>
          </div>

          {/* ── Table ── */}
          <div className={panel.group}>
            <div className={panel.groupLabel}>Table</div>
            <ToggleRow
              label="Colour by site"
              sub="Each site its own colour, so crews stand out"
              checked={opts.colour}
              onChange={(v) => setOpt("colour", v)}
            />
            <ToggleRow
              label="Job numbers"
              sub="The SimPRO job number beside each site"
              checked={opts.refs}
              onChange={(v) => setOpt("refs", v)}
            />
            <ToggleRow
              label="Weekend"
              sub={weekendBooked ? "Shown: someone is booked on the weekend" : "Saturday and Sunday columns"}
              checked={opts.weekend || weekendBooked}
              disabled={weekendBooked}
              onChange={(v) => setOpt("weekend", v)}
            />
          </div>

          {/* ── Team ── */}
          {data && data.staff.length > 0 && (
            <div className={panel.group}>
              <div className={panel.groupLabelRow}>
                <span className={panel.groupLabel}>Team</span>
                <span className={panel.subLabel}>
                  {model.staffCount} of {data.staff.length}
                </span>
              </div>
              <p className={panel.subLabel}>Everyone scheduled in SimPRO this week. Switch off anyone to leave out, such as office staff.</p>
              {data.staff.map((s) => (
                <ToggleRow key={s.id} label={s.name} checked={!hidden.includes(s.id)} onChange={(v) => setShown(s.id, v)} />
              ))}
            </div>
          )}
        </aside>

        <div ref={previewRef} className={shell.canvas}>
          {load.phase === "error" && (
            <div className={styles.notice}>
              <b>Couldn&apos;t read the SimPRO schedule.</b> {load.message}{" "}
              <button className={styles.textBtn} onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </button>
            </div>
          )}
          {data && data.skipped > 0 && (
            <div className={styles.notice}>
              {data.skipped} leave or activity schedule{data.skipped === 1 ? "" : "s"} couldn&apos;t be read and{" "}
              {data.skipped === 1 ? "is" : "are"} shown by its SimPRO reference.
            </div>
          )}
          {load.phase === "loading" && <div className={shell.pageLabel}>Reading the schedule from SimPRO…</div>}
          {data && !data.staff.length && <div className={shell.pageLabel}>Nobody is scheduled in SimPRO this week.</div>}
          {data && data.staff.length > 0 && !model.staffCount && (
            <div className={shell.pageLabel}>Everyone is switched off in Team.</div>
          )}
          {ready && (
            <div style={{ zoom }}>
              <WeekScheduleDocument model={model} logo={LOGO} screen />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chevron({ left }: { left?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d={left ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
