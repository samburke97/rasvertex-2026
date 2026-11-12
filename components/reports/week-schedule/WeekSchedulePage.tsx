"use client";
// components/reports/week-schedule/WeekSchedulePage.tsx
//
// Weekly schedule: one row per staff member, one column per day, each cell
// the site(s) they're scheduled on in SimPRO, or their leave. Read-only:
// SimPRO is the source of truth. "Copy for Excel" puts the table on the
// clipboard (pastes into the weekly spreadsheet with its formatting) and
// "Print / PDF" prints it on one landscape A4 page.

import { useCallback, useEffect, useMemo, useState } from "react";
import BuilderHeader, { HeaderButton } from "@/components/reports/shared/builder/BuilderHeader";
import styles from "./WeekSchedulePage.module.css";
import {
  addDays,
  cellItems,
  fromIso,
  iso,
  mondayOf,
  refText,
  siteTones,
  weekDays,
  weekTitle,
  type CellItem,
  type WeekScheduleResponse,
} from "@/lib/reports/weekSchedule";

interface Props {
  onBack: () => void;
}

type Load =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; data: WeekScheduleResponse };

// Per-viewer conveniences (hidden rows, display toggles): browser storage,
// best effort.
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

interface Opts {
  refs: boolean;
  colour: boolean;
  weekend: boolean;
}
const DEFAULT_OPTS: Opts = { refs: false, colour: true, weekend: false };

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const shortDate = (d: string) =>
  fromIso(d).toLocaleDateString("en-AU", { month: "short", day: "2-digit" }).replace(" ", "-");

const isOff = (it: CellItem) => it.kind === "activity";
const hrs = (n: number) => `${Math.round(n * 100) / 100} hr${n === 1 ? "" : "s"}`;

export default function WeekSchedulePage({ onBack }: Props) {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [hidden, setHidden] = useState<number[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [opts, setOpts] = useState<Opts>(DEFAULT_OPTS);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    setHidden(readJSON<number[]>(HIDDEN_KEY, []));
    setOpts({ ...DEFAULT_OPTS, ...readJSON<Partial<Opts>>(OPTS_KEY, {}) });
  }, []);
  const setOpt = (k: keyof Opts, v: boolean) =>
    setOpts((o) => {
      const n = { ...o, [k]: v };
      writeJSON(OPTS_KEY, n);
      return n;
    });
  const toggleHidden = (id: number) =>
    setHidden((h) => {
      const n = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
      writeJSON(HIDDEN_KEY, n);
      return n;
    });

  const days7 = useMemo(() => weekDays(monday), [monday]);

  useEffect(() => {
    let live = true;
    setLoad({ phase: "loading" });
    fetch(`/api/simpro/schedules/week?from=${days7[0]}&to=${days7[6]}`)
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
  }, [days7, reloadKey]);

  const data = load.phase === "done" ? load.data : null;

  // Weekend columns show when switched on, or when anyone is scheduled then.
  const weekendBooked = !!data?.entries.some((e) => e.date === days7[5] || e.date === days7[6]);
  const days = opts.weekend || weekendBooked ? days7 : days7.slice(0, 5);

  const grid = useMemo(() => {
    const m = new Map<string, CellItem[]>();
    if (!data) return m;
    const by = new Map<string, typeof data.entries>();
    for (const e of data.entries) {
      const k = `${e.staffId}|${e.date}`;
      by.set(k, [...(by.get(k) ?? []), e]);
    }
    by.forEach((es, k) => m.set(k, cellItems(es)));
    return m;
  }, [data]);

  const tones = useMemo(() => siteTones(data?.entries ?? []), [data]);
  const siteTone = (label: string) => tones.get(label);

  const staff = data?.staff ?? [];
  const visible = staff.filter((s) => !hidden.includes(s.id));
  const hiddenStaff = staff.filter((s) => hidden.includes(s.id));
  const rows = showHidden ? staff : visible;
  const sites = useMemo(
    () => new Set((data?.entries ?? []).filter((e) => e.kind !== "activity").map((e) => e.label)).size,
    [data],
  );

  // ── Copy for Excel ───────────────────────────────────────────────────────
  const cellText = (it: CellItem) => (opts.refs && it.refs.length ? `${it.label} (${refText(it.refs)})` : it.label);
  const copyForExcel = useCallback(async () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const td = "border:1px solid #9aa3ad;padding:3px 8px;text-align:center;font-family:Calibri,Arial;font-size:11pt;";
    const head = "background:#1f2a44;color:#fff;font-weight:bold;";
    const sub = "background:#dce3ee;color:#1f2a44;font-weight:bold;";
    const html =
      `<table style="border-collapse:collapse">` +
      `<tr><td style="${td}${head}"></td><td style="${td}${head}"></td>${days.map((d) => `<td style="${td}${head}">${shortDate(d)}</td>`).join("")}</tr>` +
      `<tr><td style="${td}${sub}"></td><td style="${td}${sub}text-align:left">Name</td>${days.map((_, i) => `<td style="${td}${sub}">${DAY_NAMES[i]}</td>`).join("")}</tr>` +
      visible
        .map(
          (s, n) =>
            `<tr><td style="${td}">${n + 1}</td><td style="${td}text-align:left">${esc(s.name)}</td>` +
            days
              .map((d) => {
                const items = grid.get(`${s.id}|${d}`) ?? [];
                const bg = opts.colour && items[0] && !isOff(items[0]) ? `background:${siteTone(items[0].label)};` : "";
                return `<td style="${td}${bg}">${items.map((it) => esc(cellText(it))).join("<br>")}</td>`;
              })
              .join("") +
            `</tr>`,
        )
        .join("") +
      `</table>`;
    const tsv = [
      ["", "", ...days.map(shortDate)].join("\t"),
      ["", "Name", ...days.map((_, i) => DAY_NAMES[i])].join("\t"),
      ...visible.map((s, n) =>
        [String(n + 1), s.name, ...days.map((d) => (grid.get(`${s.id}|${d}`) ?? []).map(cellText).join(" / "))].join("\t"),
      ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, visible, grid, opts, tones]);

  const thisWeek = iso(monday) === iso(mondayOf(new Date()));
  const nextWeek = iso(monday) === iso(addDays(mondayOf(new Date()), 7));

  return (
    <div className={styles.page}>
      <BuilderHeader
        onBack={onBack}
        title="Weekly schedule"
        subtitle={weekTitle(monday)}
        badges={data ? [`${visible.length} staff`, `${sites} site${sites === 1 ? "" : "s"}`] : undefined}
        status={
          load.phase === "loading"
            ? { text: "Reading SimPRO…", busy: true }
            : copied === "ok"
              ? { text: "Copied. Paste into Excel" }
              : undefined
        }
      >
        <HeaderButton onClick={copyForExcel} disabled={!data || !visible.length}>
          {copied === "fail" ? "Couldn't copy" : "Copy for Excel"}
        </HeaderButton>
        <HeaderButton primary onClick={() => window.print()} disabled={!data || !visible.length}>
          Print / PDF
        </HeaderButton>
      </BuilderHeader>

      <div className={styles.toolbar}>
        <div className={styles.weekNav}>
          <button className={styles.navBtn} onClick={() => setMonday((m) => addDays(m, -7))} aria-label="Previous week">
            <Chevron left />
          </button>
          <span className={styles.weekLabel}>{weekTitle(monday)}</span>
          <button className={styles.navBtn} onClick={() => setMonday((m) => addDays(m, 7))} aria-label="Next week">
            <Chevron />
          </button>
          <button
            className={`${styles.pill} ${thisWeek ? styles.pillOn : ""}`}
            onClick={() => setMonday(mondayOf(new Date()))}
          >
            This week
          </button>
          <button
            className={`${styles.pill} ${nextWeek ? styles.pillOn : ""}`}
            onClick={() => setMonday(addDays(mondayOf(new Date()), 7))}
          >
            Next week
          </button>
        </div>
        <div className={styles.toggles}>
          <Check label="Job numbers" on={opts.refs} set={(v) => setOpt("refs", v)} />
          <Check label="Colour by site" on={opts.colour} set={(v) => setOpt("colour", v)} />
          <Check
            label="Weekend"
            on={opts.weekend || weekendBooked}
            disabled={weekendBooked}
            title={weekendBooked ? "Shown: someone is scheduled on the weekend" : undefined}
            set={(v) => setOpt("weekend", v)}
          />
          <button className={styles.textBtn} onClick={() => setReloadKey((k) => k + 1)} disabled={load.phase === "loading"}>
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.canvas}>
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
        {data && !staff.length && <div className={styles.empty}>Nobody is scheduled in SimPRO this week.</div>}

        {(load.phase === "loading" || staff.length > 0) && (
          <div className={`${styles.sheet} ${load.phase === "loading" ? styles.sheetLoading : ""}`} data-print-area>
            <div className={styles.printTitle}>
              <span>RAS-VERTEX weekly schedule</span>
              <span>{weekTitle(monday)}</span>
            </div>
            <table className={styles.table}>
              <thead>
                <tr className={styles.dateRow}>
                  <th className={styles.numCol} />
                  <th className={styles.nameCol} />
                  {days.map((d) => (
                    <th key={d}>{shortDate(d)}</th>
                  ))}
                </tr>
                <tr className={styles.dayRow}>
                  <th className={styles.numCol} />
                  <th className={`${styles.nameCol} ${styles.left}`}>Name</th>
                  {days.map((d, i) => (
                    <th key={d}>{DAY_NAMES[i]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {load.phase === "loading" &&
                  Array.from({ length: 12 }, (_, i) => (
                    <tr key={i}>
                      <td className={styles.numCol}>{i + 1}</td>
                      <td className={styles.nameCol}>
                        <span className={styles.skel} style={{ width: 90 + ((i * 37) % 60) }} />
                      </td>
                      {days.map((d) => (
                        <td key={d}>
                          <span className={styles.skel} style={{ width: 60 + ((i * 53 + d.length * 7) % 50) }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                {data &&
                  rows.map((s) => {
                    const off = hidden.includes(s.id);
                    return (
                      <tr key={s.id} className={off ? styles.rowHidden : ""}>
                        <td className={styles.numCol}>{off ? "" : visible.indexOf(s) + 1}</td>
                        <td className={styles.nameCol}>
                          <span className={styles.name}>{s.name}</span>
                          <button
                            className={styles.hideBtn}
                            onClick={() => toggleHidden(s.id)}
                            title={off ? "Show in the schedule" : "Leave out of the schedule (e.g. office staff)"}
                          >
                            {off ? "Show" : "Hide"}
                          </button>
                        </td>
                        {days.map((d) => {
                          const items = grid.get(`${s.id}|${d}`) ?? [];
                          const first = items[0];
                          const tint = opts.colour && first && !isOff(first) ? siteTone(first.label) : undefined;
                          return (
                            <td
                              key={d}
                              style={tint ? { background: tint } : undefined}
                              title={items
                                .map((it) => [it.label, refText(it.refs), it.names.join(", "), it.hours ? hrs(it.hours) : ""].filter(Boolean).join(" · "))
                                .join("\n")}
                            >
                              {items.map((it, k) => (
                                <div key={k} className={`${styles.item} ${isOff(it) ? styles.off : ""} ${k > 0 ? styles.second : ""}`}>
                                  {it.label}
                                  {opts.refs && it.refs.length > 0 && <span className={styles.ref}> {refText(it.refs)}</span>}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {hiddenStaff.length > 0 && (
          <button className={styles.textBtn} onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? "Done" : `${hiddenStaff.length} hidden: ${hiddenStaff.map((s) => s.name.split(" ")[0]).join(", ")}. Show`}
          </button>
        )}
      </div>
    </div>
  );
}

function Check({
  label,
  on,
  set,
  disabled,
  title,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className={`${styles.check} ${disabled ? styles.checkDisabled : ""}`} title={title}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

function Chevron({ left }: { left?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d={left ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
