// components/reports/settings/ReportTypesScreen.tsx
//
// Report types: the reports, each report's types, and per type its codes,
// wording, Next steps cards and maintenance plan.
//   #types              every report
//   #types/roof         a report (its types, or its own settings)
//   #types/roof/tiled   one type

"use client";

import { useEffect, useRef, useState } from "react";
import { PLAN_INTERVALS } from "@/lib/reports/maintenancePlan";
import type { Preset, ReportDef, ReportSettings } from "@/lib/reports/settings/types";
import { CodePanel, saveCode, withPreset } from "./CodesScreen";
import RuleList, { type Part, type Rule } from "./RuleList";
import { go, useSettings } from "./store";
import { Chev, CodeChip, Ic, P, Seg, Toggle, freshKey, orList, useOutside } from "./ui";

const EMPTY = (key: string, name: string): Preset => ({
  key,
  name,
  codes: null,
  level: "",
  scope: "",
  intro: "",
  about: [],
  extras: [],
  excl: "",
  plan: [],
});

const codesLabel = (p: Preset) => (p.codes ? `${p.codes.length} codes` : "All codes");

export default function ReportTypesScreen({ path }: { path: string[] }) {
  const { s } = useSettings();
  const [rk, tk] = path;
  const r = rk ? s.reports.find((x) => x.key === rk) : undefined;
  if (rk && !r) return <ReportList />;
  if (!r) return <ReportList />;
  if (tk) {
    const t = r.types.find((x) => x.key === tk);
    return t ? <PresetPage report={r} preset={t} /> : <ReportPage report={r} />;
  }
  return r.types.length ? <ReportPage report={r} /> : <PresetPage report={r} preset={r} />;
}

function ReportList() {
  const { s, set } = useSettings();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const rows = s.reports.filter((r) => !term || `${r.name} ${r.types.map((t) => t.name).join(" ")}`.toLowerCase().includes(term));
  const add = () => {
    const key = freshKey("new-report", s.reports.map((r) => r.key));
    set((p) => ({ ...p, reports: [...p.reports, { ...EMPTY(key, "New report"), types: [] }] }));
    go(`#types/${key}`);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Report types</h1>
          <p className="t-sub">Each inspection report and its types. Click one to set its codes, wording, next steps and maintenance plan.</p>
        </div>
        <button className="btn btn--primary" onClick={add}>
          New report
        </button>
      </div>
      <input className="search" aria-label="Search reports" placeholder="Search reports" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="list">
        {rows.map((r) => (
          <button key={r.key} className="row row--plain" onClick={() => go(`#types/${r.key}`)}>
            <span className="row__main">
              <span className="row__title">{r.name}</span>
              <span className="row__sub">{r.types.length ? r.types.map((t) => t.name).join(", ") : "No types"}</span>
            </span>
            <span className="hint">{r.types.length ? `${r.types.length} types` : codesLabel(r)}</span>
            <Chev />
          </button>
        ))}
        {!rows.length && <div className="empty">No reports match.</div>}
      </div>
    </div>
  );
}

/** A report's ⋯ menu. */
function MoreMenu({ items }: { items: { label: string; danger?: boolean; run: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(open, () => setOpen(false), ref);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn icon-btn--lg" aria-label="More" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div className="menu" role="menu" style={{ minWidth: 180 }}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              className={`menu__item${it.danger ? " menu__item--danger" : ""}`}
              onClick={() => {
                setOpen(false);
                it.run();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useReportActions(report: ReportDef) {
  const { s, set } = useSettings();
  const addType = () => {
    // A report's first type takes over its own settings, as "Standard".
    const used = report.types.map((t) => t.key);
    const key = freshKey("new-type", [...used, "standard"]);
    set((p) => ({
      ...p,
      reports: p.reports.map((r) => {
        if (r.key !== report.key) return r;
        const own: Preset = { ...EMPTY("standard", "Standard"), ...stripTypes(r), key: "standard", name: "Standard" };
        return { ...r, types: r.types.length ? [...r.types, EMPTY(key, "New type")] : [own, EMPTY(key, "New type")] };
      }),
    }));
    go(`#types/${report.key}/${key}`);
  };
  const removeReport =
    s.reports.length > 1
      ? () => {
          if (!confirm(`Remove ${report.name}? Reports already started keep their own copy.`)) return;
          set((p) => ({ ...p, reports: p.reports.filter((r) => r.key !== report.key) }));
          go("#types");
        }
      : null;
  return { addType, removeReport };
}

const stripTypes = (r: ReportDef): Preset => {
  const { types: _t, ...p } = r;
  void _t;
  return p;
};

function ReportPage({ report }: { report: ReportDef }) {
  const { set } = useSettings();
  const { addType, removeReport } = useReportActions(report);
  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="row__main" style={{ flex: 1 }}>
          <button className="back" onClick={() => go("#types")}>
            <Ic d={P.back} size={14} stroke={2} />
            Report types
          </button>
          <input
            className="title-in"
            aria-label="Name"
            value={report.name}
            onChange={(e) => set((p) => ({ ...p, reports: p.reports.map((r) => (r.key === report.key ? { ...r, name: e.target.value } : r)) }))}
          />
        </div>
        <MoreMenu items={[{ label: "Add type", run: addType }, ...(removeReport ? [{ label: "Remove report", danger: true, run: removeReport }] : [])]} />
      </div>
      <p className="t-sub">This report has types. Each type has its own codes, wording, next steps and maintenance plan.</p>
      <div className="list">
        {report.types.map((t) => (
          <button key={t.key} className="row row--plain" onClick={() => go(`#types/${report.key}/${t.key}`)}>
            <span className="row__title">{t.name}</span>
            <span className="hint">{codesLabel(t)}</span>
            <Chev />
          </button>
        ))}
        <button className="row row--add" onClick={addType}>
          + Add type
        </button>
      </div>
    </div>
  );
}

type Tab = "codes" | "wording" | "next" | "plan";

function PresetPage({ report, preset }: { report: ReportDef; preset: Preset }) {
  const { s, set } = useSettings();
  const isType = report.types.includes(preset);
  const id = `${report.key}/${isType ? preset.key : ""}`;
  const [tab, setTab] = useState<Tab>("codes");
  const [editing, setEditing] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState<{ i: number | "new" } | null>(null);
  useEffect(() => setEditing(null), [tab, id]);
  const upd = (fn: (p: Preset) => Preset) => set((x) => withPreset(x, id, fn));
  const patch = (v: Partial<Preset>) => upd((p) => ({ ...p, ...v }));
  const { addType, removeReport } = useReportActions(report);

  const removeType = () => {
    if (!confirm(`Remove ${preset.name}? Reports already started keep their own copy.`)) return;
    set((x) => ({
      ...x,
      reports: x.reports.map((r) => {
        if (r.key !== report.key) return r;
        const types = r.types.filter((t) => t.key !== preset.key);
        // The last type left becomes the report's own settings again.
        return types.length === 1 && types[0].key === "standard" ? { ...r, ...types[0], key: r.key, name: r.name, types: [] } : { ...r, types };
      }),
    }));
    go(`#types/${report.key}`);
  };

  const live = s.codes.filter((c) => !c.archived && !c.system);
  const order = s.severities.map((b) => b.key);
  const all = preset.codes === null;
  const empty = !preset.scope && !preset.intro && !preset.plan.length && !preset.about.length;
  const src = s.reports
    .flatMap((r) => (r.types.length ? r.types.map((t) => ({ p: t, label: `${r.name} · ${t.name}`, same: r.key === report.key })) : [{ p: r as Preset, label: r.name, same: false }]))
    .filter((x) => x.p !== preset && x.p.plan.length)
    .sort((a, b) => Number(b.same) - Number(a.same))[0];

  const codeOpts = (arr: string[], setW: (v: string[]) => void) =>
    live
      .slice()
      .sort((a, b) => order.indexOf(a.band) - order.indexOf(b.band))
      .map((c) => ({
        label: c.name,
        sel: arr.includes(c.code),
        chip: <CodeChip s={s} code={c.code} sm />,
        pick: () => setW(arr.includes(c.code) ? arr.filter((x) => x !== c.code) : [...arr, c.code]),
      }));
  const whenSentence = (a: string[], none: string, lead: string) =>
    a.length ? (
      <>
        {lead}
        <b>{orList(a)}</b> is found.
      </>
    ) : (
      none
    );

  const setExtra = (n: number, v: Partial<Preset["extras"][number]>) => patch({ extras: preset.extras.map((x, i) => (i === n ? { ...x, ...v } : x)) });
  const nextRules: Rule[] = preset.extras.map((x, n) => {
    const when = x.when ?? [];
    const parts: Part[] = [
      { w: "Show" },
      { key: "t", label: x.t || "heading", empty: !x.t, input: { value: x.t, set: (v) => setExtra(n, { t: v }), ph: "e.g. Membrane recoat", label: "Heading" } },
      { w: "saying" },
      { key: "d", label: x.d ? `“${x.d.length > 38 ? x.d.slice(0, 38) + "…" : x.d}”` : "text", empty: !x.d, input: { value: x.d, set: (v) => setExtra(n, { d: v }), ph: "One sentence", label: "Text", long: true } },
      { w: when.length ? "when" : "" },
      { key: "c", label: when.length ? orList(when) : "always", multi: true, opts: codeOpts(when, (v) => setExtra(n, { when: v })) },
      { w: when.length ? "is found." : "" },
    ];
    return {
      id: `next:${n}`,
      on: !x.off,
      parts,
      sentence: (
        <>
          Show <b>{x.t || "Untitled card"}</b>: “{x.d}” {whenSentence(when, "Always shown.", "Shown when ")}
        </>
      ),
    };
  });

  const setPlan = (n: number, v: Partial<Preset["plan"][number]>) => patch({ plan: preset.plan.map((x, i) => (i === n ? { ...x, ...v } : x)) });
  const planRules: Rule[] = preset.plan.map((x, n) => ({
    id: `plan:${n}`,
    on: !x.off,
    parts: [
      { w: "Offer" },
      { key: "s", label: x.service || "service", empty: !x.service, input: { value: x.service, set: (v) => setPlan(n, { service: v }), ph: "e.g. Gutter clean", label: "Service" } },
      {
        key: "i",
        label: x.interval.charAt(0).toLowerCase() + x.interval.slice(1),
        opts: PLAN_INTERVALS.map((o) => ({ label: o, sel: o === x.interval, pick: () => setPlan(n, { interval: o }) })),
      },
      { w: "as" },
      {
        key: "q",
        label: x.req ? "required" : "recommended",
        opts: ([["Required", true], ["Recommended", false]] as const).map(([o, v]) => ({ label: o, sel: x.req === v, pick: () => setPlan(n, { req: v }) })),
      },
      { w: "· tick it when" },
      { key: "c", label: x.when.length ? orList(x.when) : "never", multi: true, opts: codeOpts(x.when, (v) => setPlan(n, { when: v })) },
      { w: x.when.length ? "is found." : "" },
    ],
    sentence: (
      <>
        <b>{x.service || "Untitled service"}</b>, {x.interval.toLowerCase()}, <b>{x.req ? "required" : "recommended"}</b>.{" "}
        {whenSentence(x.when, "Not ticked to start.", "Ticked when ")}
      </>
    ),
  }));

  const removeAt = <K extends "extras" | "plan">(k: K, i: number) => patch({ [k]: preset[k].filter((_, j) => j !== i) } as Partial<Preset>);
  const toggleAt = <K extends "extras" | "plan">(k: K, i: number, on: boolean) =>
    patch({ [k]: preset[k].map((x, j) => (j === i ? { ...x, off: !on } : x)) } as Partial<Preset>);

  const menu = [
    ...(!isType ? [{ label: "Add type", run: addType }] : []),
    ...(isType ? [{ label: "Remove type", danger: true, run: removeType }] : removeReport ? [{ label: "Remove report", danger: true, run: removeReport }] : []),
  ];

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="row__main" style={{ flex: 1 }}>
          <button className="back" onClick={() => go(isType ? `#types/${report.key}` : "#types")}>
            <Ic d={P.back} size={14} stroke={2} />
            {isType ? report.name : "Report types"}
          </button>
          <input
            className="title-in"
            aria-label="Name"
            value={preset.name}
            onChange={(e) =>
              isType
                ? patch({ name: e.target.value })
                : set((p) => ({ ...p, reports: p.reports.map((r) => (r.key === report.key ? { ...r, name: e.target.value } : r)) }))
            }
          />
        </div>
        {menu.length > 0 && <MoreMenu items={menu} />}
      </div>

      {empty && src && (
        <div className="notice notice--blue">
          <span>Nothing set up yet. Copy another type and change what’s different.</span>
          <button
            className="btn btn--sm"
            onClick={() => {
              const x = JSON.parse(JSON.stringify(src.p)) as Preset;
              patch({ codes: x.codes, first: x.first, level: x.level, scope: x.scope, intro: x.intro, about: x.about, extras: x.extras, excl: x.excl, plan: x.plan });
            }}
          >
            Copy {src.label}
          </button>
        </div>
      )}

      <div className="tabs" role="tablist">
        {(
          [
            ["codes", "Codes"],
            ["wording", "Wording"],
            ["next", "Next steps"],
            ["plan", "Maintenance plan"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === "codes" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <Seg label="Codes" value={all} options={[["All codes", true], ["Choose codes", false]]} onChange={(v) => patch({ codes: v ? null : live.map((c) => c.code) })} />
            <span className="lbl">{all ? `All ${live.length} codes` : `${preset.codes!.length} of ${live.length} codes`}</span>
          </div>
          <div className="list">
            {live
              .slice()
              .sort((a, b) => order.indexOf(a.band) - order.indexOf(b.band))
              .map((c) => {
                const on = all || preset.codes!.includes(c.code);
                return (
                  <div key={c.code} className="line-row">
                    <CodeChip s={s} code={c.code} sm />
                    <button className="line-row__name" onClick={() => setCodeOpen({ i: s.codes.indexOf(c) })}>
                      {c.name}
                    </button>
                    <Toggle
                      on={on}
                      label={c.name}
                      disabled={all}
                      onChange={(v) => patch({ codes: v ? [...preset.codes!, c.code] : preset.codes!.filter((x) => x !== c.code) })}
                    />
                  </div>
                );
              })}
          </div>
          <button className="text-btn" onClick={() => setCodeOpen({ i: "new" })}>
            + New code for {preset.name}
          </button>
        </>
      )}

      {tab === "wording" && (
        <>
          <div className="field">
            <label>Scope, on the cover</label>
            <textarea className="input" rows={3} value={preset.scope} placeholder="What this inspection covers" onChange={(e) => patch({ scope: e.target.value })} />
          </div>
          <div className="field">
            <label>Intro sentence · {"{street}"} fills in the site address</label>
            <textarea className="input" rows={3} value={preset.intro} placeholder="This report outlines the … at {street}, including …" onChange={(e) => patch({ intro: e.target.value })} />
          </div>
          <div className="grid2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <div className="field">
              <label>Report name on the cover · e.g. Condition</label>
              <input className="input" value={preset.ref ?? ""} placeholder={isType ? preset.name : report.name} onChange={(e) => patch({ ref: e.target.value })} />
            </div>
            <div className="field">
              <label>Level a photo gets without one</label>
              <input className="input input--code" value={preset.level} placeholder="None" onChange={(e) => patch({ level: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <span className="sec__title" style={{ marginTop: 8 }}>
            About this report
          </span>
          {preset.about.map((a, i) => (
            <div key={i} className="card">
              <div className="card__head">
                <input
                  className="card__title"
                  aria-label="Heading"
                  value={a.t}
                  placeholder="Heading"
                  onChange={(e) => patch({ about: preset.about.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)) })}
                />
                <button className="icon-btn" aria-label="Remove card" onClick={() => patch({ about: preset.about.filter((_, j) => j !== i) })}>
                  <Ic d={P.close} size={14} stroke={2} />
                </button>
              </div>
              <textarea
                className="input"
                aria-label="Text"
                rows={2}
                value={a.d}
                onChange={(e) => patch({ about: preset.about.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)) })}
              />
            </div>
          ))}
          <button className="text-btn" onClick={() => patch({ about: [...preset.about, { t: "", d: "" }] })}>
            + Add card
          </button>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Exclusions · one per line</label>
            <textarea className="input" rows={6} value={preset.excl} onChange={(e) => patch({ excl: e.target.value })} />
          </div>
        </>
      )}

      {tab === "next" && (
        <>
          <span className="hint">Cards on the Recommended works page, under “Also worth adding”. Each one is a sentence.</span>
          <RuleList rules={nextRules} editing={editing} setEditing={setEditing} onRemove={(i) => removeAt("extras", i)} onToggle={(i, on) => toggleAt("extras", i, on)} />
          <button
            className="btn"
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              patch({ extras: [...preset.extras, { t: "", d: "", when: [] }] });
              setEditing(`next:${preset.extras.length}`);
            }}
          >
            <Ic d={P.plus} size={13} stroke={2} />
            New card
          </button>
        </>
      )}

      {tab === "plan" && (
        <>
          <span className="hint">Services offered in the maintenance plan at the end of the report. Each one is a sentence.</span>
          <RuleList rules={planRules} editing={editing} setEditing={setEditing} onRemove={(i) => removeAt("plan", i)} onToggle={(i, on) => toggleAt("plan", i, on)} />
          <button
            className="btn"
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              patch({ plan: [...preset.plan, { service: "", interval: "Annually", req: false, when: [] }] });
              setEditing(`plan:${preset.plan.length}`);
            }}
          >
            <Ic d={P.plus} size={13} stroke={2} />
            New service
          </button>
        </>
      )}

      {codeOpen && (
        <CodePanel
          key={String(codeOpen.i)}
          initial={codeOpen.i === "new" ? { code: "", name: "", band: "amber", what: "", action: "", work: "", why: "", aliases: [] } : s.codes[codeOpen.i]}
          isNew={codeOpen.i === "new"}
          forPreset={id}
          onClose={() => setCodeOpen(null)}
          onSave={(next, used) => {
            const i = codeOpen.i;
            set((p: ReportSettings) => saveCode(p, i, next, used));
            setCodeOpen(null);
          }}
          onArchive={() => {
            const i = codeOpen.i;
            if (i !== "new") set((p) => ({ ...p, codes: p.codes.map((c, j) => (j === i ? { ...c, archived: !c.archived } : c)) }));
            setCodeOpen(null);
          }}
        />
      )}
    </div>
  );
}
