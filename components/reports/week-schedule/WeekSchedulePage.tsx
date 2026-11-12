"use client";
// components/reports/week-schedule/WeekSchedulePage.tsx
//
// Weekly schedule builder: the dates and display options on the left, the
// landscape pages on the right (WeekScheduleDocument, scaled to fit), in the
// same shell as the other report builders.
//
// SimPRO is read, never written. Edits (rename, move, remove, fill an empty
// day, extra people) are a layer over SimPRO's data, saved as a draft per
// date range (/api/reports/week-schedule/[range]), so they're there when the
// page is opened again. Refresh from SimPRO replaces the day edits with
// SimPRO's fresh data (after asking); site renames and added people stay.
// Site renames are kept every week (/api/reports/settings/site-aliases).
// The preview, the PDF and Copy for Excel all use the edited schedule.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import shell from "../shared/ReportPage.module.css";
import panel from "../shared/OptionsPanel.module.css";
import styles from "./WeekSchedulePage.module.css";
import ToggleRow from "../shared/ToggleRow";
import DatePicker from "@/components/ui/DatePicker";
import BuilderHeader, { HeaderButton } from "@/components/reports/shared/builder/BuilderHeader";
import { useDraftAutosave } from "@/components/reports/shared/builder/useDraftAutosave";
import WeekScheduleDocument, { WEEK_CSS, WEEK_EDIT_CSS, pickKey, type WeekPick } from "./WeekScheduleDocument";
import WeekEditPopover from "./WeekEditPopover";
import { ANCHOR_IMAGES } from "@/lib/reports/anchor.layout";
import {
  addDays,
  buildWeekModel,
  cellOf,
  DEFAULT_WEEK_OPTIONS,
  emptyDraft,
  fillItem,
  fromIso,
  indexEntries,
  iso,
  isWeekDraft,
  MAX_RANGE_DAYS,
  mondayOf,
  rangeDays,
  rangeTitle,
  refText,
  removeItem,
  renameItem,
  resetDays,
  setItemDays,
  targetItem,
  WEEK_PAGE_W,
  dayKey,
  type EditContext,
  type EditItem,
  type SiteAliases,
  type WeekDraft,
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

type Range = { from: string; to: string };

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

const weekOf = (monday: Date): Range => ({ from: iso(monday), to: iso(addDays(monday, 6)) });
const rangeLen = (r: Range) => rangeDays(r.from, r.to).length;

export default function WeekSchedulePage({ onBack }: Props) {
  const [range, setRange] = useState<Range>(() => weekOf(mondayOf(new Date())));
  const [custom, setCustom] = useState(false);
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

  // ── SimPRO's schedule for the range ──────────────────────────────────────
  useEffect(() => {
    let live = true;
    setLoad({ phase: "loading" });
    fetch(`/api/simpro/schedules/week?from=${range.from}&to=${range.to}`)
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
  }, [range, reloadKey]);

  // ── Edits: the draft for this range, and the site names ──────────────────
  const rangeKey = `${range.from}_${range.to}`;
  const [draft, setDraftState] = useState<WeekDraft>(emptyDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    let live = true;
    setDraftReady(false);
    setTouched(false);
    fetch(`/api/reports/week-schedule/${rangeKey}`)
      .then(async (res) => (res.ok ? (await res.json()).report : null))
      .catch(() => null)
      .then((report) => {
        if (!live) return;
        setDraftState(isWeekDraft(report) ? report : emptyDraft());
        setDraftReady(true);
      });
    return () => {
      live = false;
    };
  }, [rangeKey]);
  const setDraft = useCallback((next: WeekDraft) => {
    setDraftState(next);
    setTouched(true);
  }, []);
  const { status: saveStatus } = useDraftAutosave(`/api/reports/week-schedule/${rangeKey}`, draft, {
    ready: draftReady && touched,
  });

  const [aliases, setAliasesState] = useState<SiteAliases>({});
  useEffect(() => {
    fetch("/api/reports/settings/site-aliases")
      .then((res) => (res.ok ? res.json() : { aliases: {} }))
      .then((b) => setAliasesState(b.aliases ?? {}))
      .catch(() => {});
  }, []);
  const saveAliases = (next: SiteAliases) => {
    setAliasesState(next);
    fetch("/api/reports/settings/site-aliases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliases: next }),
    }).catch(() => {});
  };

  const data = load.phase === "done" ? load.data : null;
  const model = useMemo(
    () => buildWeekModel(data ?? EMPTY, range, opts, hidden, draft, aliases),
    [data, range, opts, hidden, draft, aliases],
  );
  const ctx: EditContext = useMemo(() => ({ byDay: indexEntries(data?.entries ?? []), aliases }), [data, aliases]);
  const editCount = Object.keys(draft.days).length + draft.people.length;
  const weekendBooked = useMemo(() => {
    const ends = rangeDays(range.from, range.to).filter((d) => [0, 6].includes(fromIso(d).getDay()));
    return !!data?.entries.some((e) => ends.includes(e.date)) || Object.entries(draft.days).some(([k, v]) => v.length && ends.includes(k.split("|")[1]));
  }, [data, draft, range]);
  const people = [...(data?.staff ?? []), ...draft.people];
  const ready = !!data && model.staffCount > 0;

  // ── Picking and editing a bar ────────────────────────────────────────────
  const [pick, setPick] = useState<{ p: WeekPick; rect: DOMRect } | null>(null);
  const close = useCallback(() => setPick(null), []);
  useEffect(() => {
    const el = previewRef.current;
    if (!pick || !el) return;
    el.addEventListener("scroll", close, { passive: true });
    return () => el.removeEventListener("scroll", close);
  }, [pick, close]);
  const apply = (fn: (d: WeekDraft) => WeekDraft, keepOpen = true) => {
    setDraft(fn(draft));
    if (!keepOpen) setPick(null);
  };
  const removePick = useCallback(
    (p: WeekPick) => {
      setDraft(removeItem(ctx, draft, p));
      setPick(null);
    },
    [ctx, draft, setDraft],
  );
  // Delete removes the selected bar (not while typing).
  useEffect(() => {
    if (!pick || pick.p.item < 0) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      // Delete only: Backspace is too easy to press by accident.
      if (e.key === "Delete") {
        e.preventDefault();
        removePick(pick.p);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pick, removePick]);

  const picked = pick ? targetItem(ctx, draft, pick.p) : null;
  const pickedPerson = pick ? (people.find((s) => s.id === pick.p.staffId)?.name ?? "") : "";
  const pickedEdited = !!pick && pick.p.days.some((d) => draft.days[dayKey(pick.p.staffId, d)]);

  // ── People added here ────────────────────────────────────────────────────
  const [newPerson, setNewPerson] = useState("");
  const addPerson = () => {
    const name = newPerson.trim();
    if (!name) return;
    setDraft({ ...draft, people: [...draft.people, { id: -Date.now(), name }] });
    setNewPerson("");
  };
  const removePerson = (id: number) => {
    const days = Object.fromEntries(Object.entries(draft.days).filter(([k]) => !k.startsWith(`${id}|`)));
    setDraft({ ...draft, days, people: draft.people.filter((p) => p.id !== id) });
  };

  // ── The pages are 1810 wide, scaled to the column ────────────────────────
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
    const rows = model.rows;
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
    const filename = `Weekly Schedule ${range.from}${range.to !== range.from ? ` to ${range.to}` : ""}`;
    try {
      const res = await fetch("/api/reports/export-week-schedule-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, from: range.from, to: range.to, data, opts, hidden, draft, aliases }),
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
  }, [data, range, opts, hidden, draft, aliases]);

  // ── Dates ────────────────────────────────────────────────────────────────
  const thisWeek = weekOf(mondayOf(new Date()));
  const nextWeek = weekOf(addDays(mondayOf(new Date()), 7));
  const same = (a: Range, b: Range) => a.from === b.from && a.to === b.to;
  const len = rangeLen(range);
  // Leaving these dates: save any edit still waiting on the autosave.
  const flush = () => {
    if (!touched || !draftReady) return;
    fetch(`/api/reports/week-schedule/${rangeKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
      keepalive: true,
    }).catch(() => {});
  };
  // Refresh: SimPRO's schedule fresh, in place of the day edits (site
  // renames and people added here are kept: they aren't SimPRO's data).
  const refresh = () => {
    const n = Object.keys(draft.days).length;
    if (n && !confirm(`Refresh from SimPRO replaces ${n === 1 ? "the 1 day" : `the ${n} days`} you've edited for these dates with what's in SimPRO now. Site renames and people you've added are kept.`)) return;
    setPick(null);
    if (n) setDraft({ ...draft, days: {} });
    setReloadKey((k) => k + 1);
  };
  const step = (dir: 1 | -1) => {
    flush();
    setPick(null);
    setRange((r) => ({ from: iso(addDays(fromIso(r.from), dir * len)), to: iso(addDays(fromIso(r.to), dir * len)) }));
  };
  const pickRange = (r: Range, isCustom: boolean) => {
    if (r.from !== range.from || r.to !== range.to) flush();
    setPick(null);
    setCustom(isCustom);
    setRange(r);
  };
  // Custom: To never before From, and at most MAX_RANGE_DAYS days.
  const setFrom = (v: string | null) => {
    if (!v) return;
    const max = iso(addDays(fromIso(v), MAX_RANGE_DAYS - 1));
    pickRange({ from: v, to: range.to < v ? v : range.to > max ? max : range.to }, true);
  };
  const setTo = (v: string | null) => {
    if (!v) return;
    const min = iso(addDays(fromIso(v), -(MAX_RANGE_DAYS - 1)));
    pickRange({ from: range.from > v ? v : range.from < min ? min : range.from, to: v }, true);
  };

  const status =
    load.phase === "loading"
      ? { text: "Reading SimPRO…", busy: true }
      : copied === "ok"
        ? { text: "Copied. Paste into Excel" }
        : copied === "fail"
          ? { text: "Couldn't copy", busy: true }
          : touched
            ? saveStatus
            : undefined;

  return (
    <div className={shell.page}>
      <style dangerouslySetInnerHTML={{ __html: WEEK_CSS + WEEK_EDIT_CSS }} />
      <BuilderHeader
        onBack={onBack}
        title="Weekly schedule"
        subtitle={rangeTitle(range.from, range.to)}
        badges={data ? [`${model.staffCount} team`, `${model.siteCount} site${model.siteCount === 1 ? "" : "s"}`] : undefined}
        status={status}
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
          {/* ── Dates ── */}
          <div className={panel.group}>
            <div className={panel.groupLabel}>Dates</div>
            <div className={styles.weekNav}>
              <button className={styles.navBtn} onClick={() => step(-1)} aria-label={`Previous ${len} days`}>
                <Chevron left />
              </button>
              <span className={styles.weekLabel}>{rangeTitle(range.from, range.to)}</span>
              <button className={styles.navBtn} onClick={() => step(1)} aria-label={`Next ${len} days`}>
                <Chevron />
              </button>
            </div>
            <div className={panel.presetRow}>
              <button
                className={`${panel.presetBtn} ${!custom && same(range, thisWeek) ? panel.presetBtnActive : ""}`}
                onClick={() => pickRange(thisWeek, false)}
              >
                This week
              </button>
              <button
                className={`${panel.presetBtn} ${!custom && same(range, nextWeek) ? panel.presetBtnActive : ""}`}
                onClick={() => pickRange(nextWeek, false)}
              >
                Next week
              </button>
              <button
                className={`${panel.presetBtn} ${custom || (!same(range, thisWeek) && !same(range, nextWeek)) ? panel.presetBtnActive : ""}`}
                onClick={() => setCustom(true)}
              >
                Custom
              </button>
            </div>
            {(custom || (!same(range, thisWeek) && !same(range, nextWeek))) && (
              <>
                <div className={styles.rangeFields}>
                  <div className={panel.dateField}>
                    <label className={panel.dateFieldLabel}>From</label>
                    <DatePicker value={range.from} onChange={setFrom} />
                  </div>
                  <div className={panel.dateField}>
                    <label className={panel.dateFieldLabel}>To</label>
                    <DatePicker value={range.to} onChange={setTo} />
                  </div>
                </div>
                <p className={panel.subLabel}>Up to {MAX_RANGE_DAYS} days. Each week starts a new page.</p>
              </>
            )}
            <button className={panel.btn} onClick={refresh} disabled={load.phase === "loading"}>
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

          {/* ── Export ── */}
          <div className={panel.group}>
            <div className={panel.groupLabel}>Export</div>
            <ToggleRow
              label="Include jobs overview"
              sub="Pages after the schedule listing each job as it starts: site and address, job number and name"
              checked={opts.overview}
              onChange={(v) => setOpt("overview", v)}
            />
          </div>

          {/* ── Edits ── */}
          <div className={panel.group}>
            <div className={panel.groupLabelRow}>
              <span className={panel.groupLabel}>Edits</span>
              {editCount > 0 && <span className={panel.subLabel}>{editCount} here</span>}
            </div>
            <p className={panel.subLabel}>
              Click a bar on the page to rename, move or remove it, or an empty day to fill it. Edits stay in this report; SimPRO
              isn&apos;t changed. Edited bars show a blue dot. Refresh from SimPRO clears them.
            </p>
            {editCount > 0 && (
              <button
                className={panel.btn}
                onClick={() => {
                  if (!confirm("Reset all edits for these dates back to SimPRO?")) return;
                  setPick(null);
                  setDraft(emptyDraft());
                }}
              >
                Reset all edits
              </button>
            )}
          </div>

          {/* ── Team ── */}
          {data && (
            <div className={panel.group}>
              <div className={panel.groupLabelRow}>
                <span className={panel.groupLabel}>Team</span>
                <span className={panel.subLabel}>
                  {model.staffCount} of {people.length}
                </span>
              </div>
              <p className={panel.subLabel}>Everyone scheduled in SimPRO for these dates. Switch off anyone to leave out, such as office staff.</p>
              {people.map((s) => (
                <div key={s.id} className={styles.personRow}>
                  <ToggleRow label={s.name} sub={s.id < 0 ? "Added here" : undefined} checked={!hidden.includes(s.id)} onChange={(v) => setShown(s.id, v)} />
                  {s.id < 0 && (
                    <button className={styles.removeBtn} onClick={() => removePerson(s.id)} aria-label={`Remove ${s.name}`} title="Remove">
                      ×
                    </button>
                  )}
                </div>
              ))}
              <div className={styles.addRow}>
                <input
                  value={newPerson}
                  placeholder="Add team member"
                  onChange={(e) => setNewPerson(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPerson()}
                />
                <button className={panel.btn} onClick={addPerson} disabled={!newPerson.trim()}>
                  Add
                </button>
              </div>
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
              {data.skipped} job{data.skipped === 1 ? "" : "s"} couldn&apos;t be read from SimPRO and{" "}
              {data.skipped === 1 ? "is" : "are"} shown by number.
            </div>
          )}
          {load.phase === "loading" && <div className={shell.pageLabel}>Reading the schedule from SimPRO…</div>}
          {data && !people.length && <div className={shell.pageLabel}>Nobody is scheduled in SimPRO for these dates.</div>}
          {data && people.length > 0 && !model.staffCount && <div className={shell.pageLabel}>Everyone is switched off in Team.</div>}
          {ready && (
            <div style={{ zoom }}>
              <WeekScheduleDocument
                model={model}
                logo={LOGO}
                screen
                edit={{
                  selected: pick ? pickKey(pick.p) : null,
                  onPick: (p, el) => setPick({ p, rect: el.getBoundingClientRect() }),
                  onRemove: removePick,
                  // Added here: gone for good. From SimPRO: switched off in Team.
                  onRemoveRow: (id) => {
                    setPick(null);
                    if (id < 0) removePerson(id);
                    else setShown(id, false);
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>

      {pick && (
        <WeekEditPopover
          anchor={pick.rect}
          allDays={model.days}
          target={{
            person: pickedPerson,
            label: picked?.label ?? null,
            simproSite: !!picked && !picked.leave && !picked.flag && picked.kind !== "activity" && !pickedEdited,
            edited: pickedEdited,
            days: pick.p.days,
          }}
          onClose={close}
          onRename={(label) => {
            const r = renameItem(ctx, draft, pick.p, label);
            if (r.draft !== draft) setDraft(r.draft);
            if (r.aliases) saveAliases(r.aliases);
          }}
          onDays={(days) => {
            const next = setItemDays(ctx, draft, pick.p, days);
            setDraft(next);
            // Still the same item, wherever it now sits on its first day.
            const item = cellOf(ctx.byDay, next, aliases, pick.p.staffId, days[0]).items.findIndex((x) => x.label === picked?.label);
            setPick({ ...pick, p: { ...pick.p, days, item: Math.max(0, item) } });
          }}
          onFill={(item: EditItem) => {
            const next = fillItem(ctx, draft, pick.p, item);
            setDraft(next);
            // The filled bar stays picked (it's now that item).
            setPick({ ...pick, p: { ...pick.p, item: Math.max(0, pick.p.item) } });
          }}
          onRemove={() => removePick(pick.p)}
          onReset={() => apply((d) => resetDays(d, pick.p), false)}
        />
      )}
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
