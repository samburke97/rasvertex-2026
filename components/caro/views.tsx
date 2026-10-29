"use client";
// components/caro/views.tsx — Caro's pages: section menu, Overview, All sites,
// Clients (check-in), Automations, Email templates, Reminder timing.

import { Fragment } from "react";
import * as A from "@/lib/caro/auto";
import {
  LINE,
  LINES,
  ME,
  MERGE_FIELDS,
  TIMING_OPTIONS,
  TIMING_UNIT,
  addDays,
  fmt,
  fmtS,
  mergeVals,
  money,
  parse,
  today,
  type LineKey,
  type Template,
  type TimingKey,
} from "@/lib/caro/data";
import { useCaro, type State } from "./CaroPage";
import { needList, needOf, plural, statusOf, type XSite } from "./helpers";
import { Ic, P } from "./icons";

const Svc = ({ line }: { line: LineKey }) => (
  <span className="svc">
    <span className="dot" style={{ "--dot": LINE[line].dot } as React.CSSProperties} />
    <span className="truncate">{LINE[line].name}</span>
  </span>
);
const sum = (rs: XSite[]) => rs.reduce((a, s) => a + s.price, 0);
const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return mins < 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
};

/* ---------- section menu ---------- */
export function SectionMenu() {
  const { S, X } = useCaro();
  const needs = X.filter((s) => s.d.need).length;
  const cur = (on: boolean) => (on ? ({ "aria-current": "page" } as const) : {});
  return (
    <>
      <div className="subnav__head">
        <span className="subnav__title">Caro</span>
      </div>
      <div className="subnav__body">
        <a className="subnav__item" href="#overview" {...cur(S.view === "overview")}>
          <Ic d={P.spark} />
          <span className="subnav__text">Overview</span>
          {needs > 0 && <span className="badge badge--red">{needs}</span>}
        </a>
        <a className="subnav__item" href="#sites" {...cur(S.view === "sites" && !S.line)}>
          <Ic d={P.list} />
          <span className="subnav__text">All sites</span>
          {!S.loading && <span className="badge">{X.length}</span>}
        </a>
        <a className="subnav__item" href="#clients" {...cur(S.view === "clients")}>
          <Ic d={P.users} />
          <span className="subnav__text">Clients</span>
          {S.clientRows && <span className="badge">{S.clientRows.length}</span>}
        </a>
        <div className="subnav__divider" />
        <div className="subnav__label">Service lines</div>
        {LINES.map((l) => (
          <a key={l.key} className="subnav__item" href={`#sites/${l.key}`} {...cur(S.view === "sites" && S.line === l.key)}>
            <span className="subnav__dot" style={{ "--dot": l.dot } as React.CSSProperties} />
            <span className="subnav__text">{l.name}</span>
            {!S.loading && <span className="badge">{X.filter((s) => s.line === l.key).length}</span>}
          </a>
        ))}
        <div className="subnav__divider" />
        <div className="subnav__label">Setup</div>
        <a className="subnav__item" href="#automations" {...cur(S.view === "automations")}>
          <Ic d={P.bolt} />
          <span className="subnav__text">Automations</span>
          <span className="badge badge--blue">{S.rules.filter((r) => r.on).length} on</span>
        </a>
        <a className="subnav__item" href="#templates" {...cur(S.view === "templates")}>
          <Ic d={P.mail} />
          <span className="subnav__text">Email templates</span>
          {!S.loading && <span className="badge">{S.templates.length}</span>}
        </a>
        <a className="subnav__item" href="#timing" {...cur(S.view === "timing")}>
          <Ic d={P.sliders} />
          <span className="subnav__text">Reminder timing</span>
        </a>
      </div>
    </>
  );
}

function SyncNote() {
  const { S, act } = useCaro();
  return (
    <>
      {!S.live && <span className="mode-note" title={`Every email goes to ${S.testTo} until OUTREACH_LIVE is turned on`}>Test mode</span>}
      {S.syncedAt && <span className="sync-note">Synced {ago(S.syncedAt)}</span>}
      <button className="btn btn--quiet" onClick={act.sync} disabled={S.syncing}>
        <Ic d={P.sync} s={13} sw={1.7} />
        {S.syncing ? "Syncing…" : "Sync"}
      </button>
    </>
  );
}

/* ---------- overview ---------- */
export function Overview() {
  const { S, X, act, set } = useCaro();
  const needs = needList(X);
  const shown = S.showAllNeeds ? needs : needs.slice(0, 5);
  const auto = X.filter((s) => s.d.status === "reminded").length;
  const booked = X.filter((s) => s.booked).length;
  const headline = `${needs.length === 1 ? "1 site needs" : needs.length + " sites need"} you today. ${auto} ${auto === 1 ? "is" : "are"} being followed up, and ${booked} ${booked === 1 ? "is" : "are"} booked.`;
  const due90 = X.filter((s) => !s.booked && s.d.days <= 90);
  const leads = [...new Set(LINES.map((l) => S.timing[l.key].lead))].sort((a, b) => a - b);
  const leadText = leads.length === 1 ? leads[0] + " days" : leads[0] + "–" + leads[leads.length - 1] + " days";

  // 0 = overdue, 1 = this month … 12
  const now = today();
  const start = now.getFullYear() * 12 + now.getMonth();
  const buckets: XSite[][] = Array.from({ length: 13 }, () => []);
  X.forEach((s) => {
    if (s.d.days < 0) {
      if (!s.booked) buckets[0].push(s);
      return;
    }
    const b = 1 + s.d.next.getFullYear() * 12 + s.d.next.getMonth() - start;
    if (b <= 12) buckets[b].push(s);
  });
  const max = Math.max(1, ...buckets.map((b) => b.length));
  const mDate = (i: number) => new Date(now.getFullYear(), now.getMonth() + i - 1, 1);
  const list = buckets[S.month].slice().sort((a, b) => a.d.days - b.d.days);
  const allOn = list.length > 0 && list.every((s) => S.selected.includes(s.key));

  return (
    <div className="container">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Caro</h1>
          <p className="page-head__sub pretty">{headline}</p>
        </div>
        <div className="page-head__actions">
          <SyncNote />
          <a className="btn btn--neutral btn--md" href="#automations">
            <Ic d={P.bolt} s={14} sw={1.7} />
            Automations <span className="badge badge--blue">{S.rules.filter((r) => r.on).length}</span>
          </a>
          <button className="btn btn--primary btn--md" onClick={act.openNew}>
            <Ic d={P.plus} s={13} sw={1.8} />
            New recurring job
          </button>
        </div>
      </div>

      <section className="rj-section">
        <div className="rj-section__head">
          <div className="rj-section__text">
            <div className="rj-section__title">
              <h2 className="t-section">Needs you</h2>
              {needs.length > 0 && <span className="badge badge--red">{needs.length}</span>}
            </div>
            <p className="rj-section__sub">What reminders can’t do for you — a call, a price check, a reminder that hasn’t gone out.</p>
          </div>
        </div>
        {needs.length ? (
          <div className="needs">
            {shown.map((s) => {
              const n = needOf(s)!;
              return (
                <div className="need" key={s.key} onClick={() => act.openRecord(s.key)}>
                  <span className={`need__icon need__icon--${n.tone}`}>
                    <Ic d={n.icon} s={15} sw={1.7} />
                  </span>
                  <div className="need__main">
                    <span className="need__title truncate">{s.name}</span>
                    <span className="need__reason truncate">{n.reason}</span>
                  </div>
                  <Svc line={s.line} />
                  <span className="need__value">{money(s.price)}</span>
                  <button
                    className="btn btn--neutral btn--sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (n.act === "composeOne") act.composeOne(s.key);
                      else if (n.act === "reviewPrice") act.reviewPrice(s.key);
                      else act.openRecord(s.key);
                    }}
                  >
                    {n.action}
                  </button>
                </div>
              );
            })}
            {needs.length > 5 && (
              <button className="needs__more" onClick={act.toggleNeeds}>
                {S.showAllNeeds ? "Show fewer" : "Show all " + needs.length}
              </button>
            )}
          </div>
        ) : (
          <div className="empty empty--dashed">
            <span className="empty__title">Nothing needs you today</span>
            <span className="empty__sub">Every site is reminded, booked or not due yet.</span>
          </div>
        )}
      </section>

      <section className="rj-section">
        <div className="rj-section__head">
          <div className="rj-section__text">
            <h2 className="t-section">When work comes due</h2>
            <p className="rj-section__sub">
              {plural(due90.length, "site")} due in the next 90 days, worth {money(sum(due90))}. Reminders go out {leadText} before each due date.{" "}
              <a href="#timing">Change the timing</a>
            </p>
          </div>
        </div>
        <div className="due-chart" role="tablist">
          {buckets.map((b, i) => (
            <button
              key={i}
              className={`due-bar${i === 0 ? " due-bar--overdue" : ""}`}
              onClick={() => act.pickMonth(i)}
              aria-pressed={S.month === i}
              title={`${plural(b.length, "site")} · ${money(sum(b))}`}
            >
              <span className="due-bar__count">{b.length}</span>
              <span className="due-bar__track">
                <span className="due-bar__fill" style={{ "--h": `${Math.round((b.length / max) * 100)}%` } as React.CSSProperties} />
              </span>
              <span className="due-bar__label">{i === 0 ? "Overdue" : mDate(i).toLocaleDateString("en-AU", { month: "short" })}</span>
            </button>
          ))}
        </div>
        <div className="month-head">
          <span className="t-group">{S.month === 0 ? "Overdue" : mDate(S.month).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</span>
          <span className="t-meta">
            {plural(list.length, "site")} · {money(sum(list))}
          </span>
          <span style={{ flex: 1 }} />
          {list.length > 0 && (
            <button className="text-btn" onClick={() => set({ selected: allOn ? [] : list.map((s) => s.key) })}>
              {allOn ? "Clear selection" : "Select all"}
            </button>
          )}
        </div>
        {list.length ? (
          <div className="list month-list">
            {list.map((s) => {
              const sel = S.selected.includes(s.key);
              const st = statusOf(s);
              return (
                <div className={`row${sel ? " is-selected" : ""}`} key={s.key} onClick={() => act.openRecord(s.key)}>
                  <Check on={sel} label={s.name} onClick={() => act.select(s.key)} />
                  <div className="row__main">
                    <span className="row__title truncate">{s.name}</span>
                    <span className="row__sub truncate">
                      {[s.suburb || s.customer, LINE[s.line].name, s.d.days < 0 ? "overdue " + -s.d.days + " days" : "due " + fmtS(s.d.next)].join(" · ")}
                    </span>
                  </div>
                  <span className={`state state--${st.tone}`}>{st.text}</span>
                  <span className="row__value">{money(s.price)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty empty--dashed">
            <span className="empty__title">Nothing due this month</span>
            <span className="empty__sub">Pick another month above.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function Check({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className="check"
      aria-checked={on}
      role="checkbox"
      aria-label={`Select ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Ic d={P.check} s={9} sw={3} />
    </button>
  );
}

/* ---------- all sites / service line ---------- */
const STATUS_FILTERS: [string, string][] = [
  ["all", "All"],
  ["needs", "Needs you"],
  ["overdue", "Overdue"],
  ["soon", "Due soon"],
  ["booked", "Booked"],
];
const SORTS: [string, string][] = [
  ["due", "Next due"],
  ["value", "Price"],
  ["name", "Name"],
];
export function sitesVisible(S: State, X: XSite[]) {
  const q = S.search.trim().toLowerCase();
  const match = (s: XSite, k: string) =>
    k === "all" ||
    (k === "needs" && !!s.d.need) ||
    (k === "overdue" && s.d.days < 0 && !s.booked) ||
    (k === "soon" && !s.booked && s.d.days >= 0 && s.d.days <= S.timing[s.line].lead) ||
    (k === "booked" && !!s.booked);
  const pool = X.filter((s) => (!S.line || s.line === S.line) && (!q || [s.name, s.customer, s.suburb, s.first, s.contact].some((v) => v.toLowerCase().includes(q))));
  const rows = pool.filter((s) => match(s, S.status));
  rows.sort(S.sort === "value" ? (a, b) => b.price - a.price : S.sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.d.days - b.d.days);
  return { pool, rows, match };
}
export function Sites() {
  const { S, X, set, act } = useCaro();
  const L = S.line ? LINE[S.line] : null;
  const scope = X.filter((s) => !S.line || s.line === S.line);
  const { pool, rows, match } = sitesVisible(S, X);
  const annual = scope.reduce((a, s) => a + s.d.annual, 0);
  const allOn = rows.length > 0 && rows.every((s) => S.selected.includes(s.key));
  return (
    <div className="container container--wide">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">{L ? L.name : "All sites"}</h1>
          <p className="page-head__sub">
            {plural(scope.length, "site")} · {money(annual)} a year
            {S.line && (
              <>
                {" "}· reminders {S.timing[S.line].lead} days ahead · <a href="#timing">Change</a>
              </>
            )}
          </p>
        </div>
        <div className="page-head__actions">
          <div className="search" style={{ width: 220 }}>
            <Ic d={P.search} s={14} />
            <input value={S.search} onChange={(e) => set({ search: e.target.value, selected: [] })} placeholder="Search sites" />
          </div>
          <button className="btn btn--primary btn--md" onClick={act.openNew}>
            <Ic d={P.plus} s={13} sw={1.8} />
            New recurring job
          </button>
        </div>
      </div>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <div className="seg">
          {STATUS_FILTERS.map(([k, label]) => (
            <button key={k} className="seg__btn" onClick={() => set({ status: k, selected: [] })} aria-pressed={S.status === k}>
              {label} <span className="seg__count">{pool.filter((s) => match(s, k)).length}</span>
            </button>
          ))}
        </div>
        <span className="toolbar__spacer" />
        <div className="pop-wrap" data-pop>
          <button className={`btn btn--quiet${S.sortOpen ? " is-active" : ""}`} onClick={() => set({ sortOpen: !S.sortOpen })}>
            <Ic d={P.sort} s={13} sw={1.7} />
            Sort: {SORTS.find((x) => x[0] === S.sort)![1]}
          </button>
          {S.sortOpen && (
            <div className="menu" role="menu">
              {SORTS.map(([k, label]) => (
                <div key={k} className="menu__item" onClick={() => set({ sort: k, sortOpen: false })}>
                  <span className="menu__tick">{S.sort === k && <Ic d={P.check} s={11} sw={3} />}</span>
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="table sites-table">
            <div className="table__row table__row--head">
              <Check on={allOn} label="all" onClick={() => set({ selected: allOn ? [] : rows.map((s) => s.key) })} />
              <span>Site</span>
              <span>Service</span>
              <span>Every</span>
              <span>Next due</span>
              <span>Status</span>
              <span className="th-right">Price</span>
            </div>
            {rows.map((s) => {
              const sel = S.selected.includes(s.key);
              const st = statusOf(s);
              const od = s.d.days < 0 && !s.booked;
              return (
                <div key={s.key} className={`table__row${sel ? " is-selected" : ""}`} onClick={() => act.openRecord(s.key)}>
                  <Check on={sel} label={s.name} onClick={() => act.select(s.key)} />
                  <div className="site-cell">
                    <span className="site-cell__name truncate">{s.name}</span>
                    <span className="site-cell__addr truncate">{[s.customer, s.suburb].filter(Boolean).join(" · ")}</span>
                  </div>
                  <Svc line={s.line} />
                  <span className="rj-cell">{s.interval} months</span>
                  <span className={`rj-cell${od ? " rj-cell--red" : ""}`}>{od ? `Overdue ${-s.d.days}d` : fmt(s.d.next)}</span>
                  <span className={`pill pill--${st.pill}`}>{st.label}</span>
                  <span className="rj-cell rj-cell--money">{money(s.price)}</span>
                </div>
              );
            })}
          </div>
          <span className="sites-foot">{plural(rows.length, "site")} shown</span>
        </>
      ) : (
        <div className="empty empty--dashed">
          <span className="empty__title">Nobody matches that yet</span>
          <span className="empty__sub">Try a different name, suburb or status.</span>
          <button className="btn btn--neutral btn--sm" onClick={act.clearSiteFilters}>
            Clear search and filters
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- clients (check-in) ---------- */
const CLIENT_FILTERS: [string, string][] = [
  ["all", "All"],
  ["call", "Worth a call"],
  ["recurring", "On recurring"],
  ["blocked", "Blocked"],
];
export function Clients() {
  const { S, X, set, act } = useCaro();
  const rows = S.clientRows;
  const recurringIds = new Set(X.map((s) => s.customerId));
  const q = S.clientSearch.trim().toLowerCase();
  const match = (r: NonNullable<typeof rows>[number], k: string) =>
    k === "all" || (k === "call" && !!r.leadId && !r.blockers.length) || (k === "recurring" && recurringIds.has(r.id)) || (k === "blocked" && r.blockers.length > 0);
  const pool = (rows ?? []).filter((r) => !q || [r.name, r.contactName, r.email, r.suburb, r.site].some((v) => (v || "").toLowerCase().includes(q)));
  const shown = pool.filter((r) => match(r, S.clientFilter));
  const limit = 200;
  return (
    <div className="container container--wide">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Clients</h1>
          <p className="page-head__sub">
            Every SimPRO client, best follow-up first. Click one for their history and a ready-made check-in email.
            {S.clientsSyncedAt && ` Synced ${ago(S.clientsSyncedAt)}.`}
          </p>
        </div>
        <div className="page-head__actions">
          <a className="btn btn--quiet" href="/api/checkin/export">
            <Ic d={P.download} s={13} sw={1.7} />
            Export CSV
          </a>
          <button className="btn btn--quiet" onClick={act.syncClients} disabled={S.clientSyncing} title="Takes a couple of minutes">
            <Ic d={P.sync} s={13} sw={1.7} />
            {S.clientSyncing ? "Refreshing…" : "Refresh from SimPRO"}
          </button>
          <div className="search" style={{ width: 240 }}>
            <Ic d={P.search} s={14} />
            <input value={S.clientSearch} onChange={(e) => set({ clientSearch: e.target.value })} placeholder="Search clients" />
          </div>
        </div>
      </div>
      <div className="toolbar">
        <div className="seg">
          {CLIENT_FILTERS.map(([k, label]) => (
            <button key={k} className="seg__btn" onClick={() => set({ clientFilter: k })} aria-pressed={S.clientFilter === k}>
              {label} <span className="seg__count">{pool.filter((r) => match(r, k)).length}</span>
            </button>
          ))}
        </div>
      </div>
      {S.clientsError ? (
        <div className="empty empty--dashed">
          <span className="empty__title">Couldn’t load clients</span>
          <span className="empty__sub">{S.clientsError}</span>
          <button className="btn btn--neutral btn--sm" onClick={act.loadClients}>
            Try again
          </button>
        </div>
      ) : !rows ? (
        <div className="list">
          {[50, 38, 60, 44].map((w, i) => (
            <div className="row" key={i} style={{ cursor: "default" }}>
              <div className="row__main" style={{ gap: 7 }}>
                <span className="sk sk--title" style={{ width: `${w}%` }} />
                <span className="sk sk--line" style={{ width: "30%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length ? (
        <>
          <div className="table clients-table">
            <div className="table__row table__row--head">
              <span>Client</span>
              <span>Type</span>
              <span>Last job</span>
              <span className="th-right">Lifetime</span>
              <span>Follow-up</span>
            </div>
            {shown.slice(0, limit).map((r) => (
              <div key={r.id} className="table__row" onClick={() => act.openClient(r.id)}>
                <div className="site-cell">
                  <span className="site-cell__name truncate">{r.name}</span>
                  <span className="site-cell__addr truncate">{[r.contactName, r.email || "No email"].filter(Boolean).join(" · ")}</span>
                </div>
                <span className="rj-cell">{r.type}</span>
                <div className="site-cell">
                  <span className="rj-cell">{r.lastJobDate ? fmt(parse(r.lastJobDate)) : "—"}</span>
                  <span className="site-cell__addr truncate">{r.lastJobDesc || ""}</span>
                </div>
                <span className="rj-cell rj-cell--money">{money(r.ltv)}</span>
                {r.blockers.length ? (
                  <span className="pill pill--overdue truncate" style={{ maxWidth: "100%" }}>
                    {r.blockers.join(" · ")}
                  </span>
                ) : (
                  <span className="rj-cell" style={{ color: r.leadTitle ? "var(--ink)" : undefined }}>
                    {r.leadTitle || "Nothing to chase"}
                  </span>
                )}
              </div>
            ))}
          </div>
          <span className="sites-foot">
            {shown.length > limit ? `First ${limit} of ${shown.length} shown — search to narrow it down` : plural(shown.length, "client") + " shown"}
          </span>
        </>
      ) : (
        <div className="empty empty--dashed">
          <span className="empty__title">{rows.length ? "Nobody matches that yet" : "No clients yet"}</span>
          <span className="empty__sub">{rows.length ? "Try a different name or filter." : "Refresh from SimPRO to pull every client in."}</span>
          {rows.length > 0 && (
            <button className="btn btn--neutral btn--sm" onClick={() => set({ clientSearch: "", clientFilter: "all" })}>
              Clear search and filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- automations ---------- */
export function Automations() {
  const { S, act } = useCaro();
  if (S.autoView === "builder" && S.rule) return <Builder />;
  const running = S.rules.filter((r) => r.on).length;
  return (
    <div className="container container--narrow">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Automations</h1>
          <p className="page-head__sub pretty">Rules that run on every recurring site at 6:00 each morning, and the moment something happens. Each one is a sentence.</p>
        </div>
        <div className="page-head__actions">
          <div className="seg">
            <button className="seg__btn" onClick={() => act.go("#automations")} aria-pressed={S.autoView === "running"}>
              Running <span className="seg__count">{running}</span>
            </button>
            <button className="seg__btn" onClick={() => act.go("#automations/library")} aria-pressed={S.autoView === "library"}>
              Library
            </button>
          </div>
          <button className="btn btn--primary btn--md" onClick={act.newAuto}>
            <Ic d={P.plus} s={13} sw={1.8} />
            New automation
          </button>
        </div>
      </div>
      {S.autoView === "library" ? <Library /> : <Running />}
    </div>
  );
}
function Running() {
  const { S, act, ruleHtml, tplNames } = useCaro();
  const running = S.rules.filter((r) => r.on).length;
  const paused = S.rules.length - running;
  return (
    <>
      <section className="seq">
        <div className="seq__head">
          <span className="seq__icon">
            <Ic d={P.repeat} s={15} sw={1.8} />
          </span>
          <div className="seq__text">
            <span className="t-ui" style={{ fontWeight: 600 }}>
              Reminder sequence
            </span>
            <span className="t-meta">Built in. Runs for every site, using each service line’s timing.</span>
          </div>
          <a className="btn btn--neutral btn--sm" href="#timing">
            Edit timing
          </a>
        </div>
        {LINES.map((l) => {
          const t = S.timing[l.key];
          return (
            <div className="seq__row" key={l.key}>
              <span className="seq__line">
                <span className="dot" style={{ "--dot": l.dot } as React.CSSProperties} />
                {l.name}
              </span>
              <div className="seq__steps">
                <span className="seq__step">Reminder {t.lead} days before</span>
                <Ic d={P.chevR} s={12} sw={2} className="seq__arrow" />
                <span className="seq__step">Follow-up after {t.follow} days</span>
                <Ic d={P.chevR} s={12} sw={2} className="seq__arrow" />
                <span className="seq__step">Needs you after {t.flag} days</span>
              </div>
            </div>
          );
        })}
      </section>
      <section className="rj-section">
        <div className="rj-section__head">
          <div className="rj-section__text">
            <h2 className="t-group">Your automations</h2>
            <span className="t-meta">
              {running} on{paused ? ` · ${paused} paused` : ""}
            </span>
          </div>
        </div>
        {S.rules.length ? (
          <div className="list rules">
            {S.rules.map((v) => (
              <div className={`row${v.on ? "" : " is-off"}`} key={v.id}>
                <button className="toggle" role="switch" onClick={() => act.toggleRule(v.id)} aria-checked={v.on} title={v.on ? "Pause" : "Turn on"} />
                <div className="row__main">
                  <span className="rule-text">{ruleHtml(v.rule)}</span>
                  <span className="row__sub">{v.last}</span>
                </div>
                <span className="initials" title={v.owner}>
                  {v.owner}
                </span>
                <button className="icon-btn icon-btn--sm" onClick={() => act.editRule(v.id)} title="Edit">
                  <Ic d={P.rename} s={13} sw={1.7} />
                </button>
                <button className="icon-btn icon-btn--sm" onClick={() => act.askDeleteRule(v.id, A.ruleText(v.rule, tplNames))} title="Delete">
                  <Ic d={P.trash} s={13} sw={1.7} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty empty--dashed">
            <span className="empty__title">Nothing extra running yet</span>
            <span className="empty__sub">The reminder sequence still runs. Add a rule for anything else.</span>
            <a className="btn btn--secondary btn--sm" href="#automations/library">
              Browse the library
            </a>
          </div>
        )}
      </section>
    </>
  );
}
function Library() {
  const { S, set, act, ruleHtml, tplNames } = useCaro();
  const q = S.autoSearch.trim().toLowerCase();
  let pool = A.RECIPES.filter((r) => S.cat === "Explore" || (S.cat === "Popular" ? r.basic : r.cat === S.cat));
  if (q) pool = pool.filter((r) => A.ruleText(r.rule, tplNames).toLowerCase().includes(q));
  const basics = pool.filter((r) => r.basic);
  const more = pool.filter((r) => !r.basic);
  const brands = S.cat === "Integrations" && !q;
  const card = (r: A.Recipe) => (
    <button className="recipe" key={r.id} onClick={() => act.useRecipe(r.id)}>
      <span className={`recipe__icon recipe__icon--${r.tone}`}>
        <Ic d={P.bolt} s={13} sw={1.8} />
      </span>
      <span className="recipe__text">{ruleHtml(r.rule)}</span>
      <span className="recipe__go">
        <Ic d={P.arrowR} s={15} sw={1.9} />
      </span>
    </button>
  );
  return (
    <>
      <div className="lib-bar">
        <div className="cats">
          {A.CATEGORIES.map((c) => (
            <button key={c.name} className="cat" onClick={() => set({ cat: c.name })} aria-pressed={S.cat === c.name}>
              <Ic d={c.icon} s={13} sw={1.7} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="search">
          <Ic d={P.search} s={14} />
          <input value={S.autoSearch} onChange={(e) => set({ autoSearch: e.target.value })} placeholder="Search recipes" />
        </div>
      </div>
      {S.cat === "Explore" && !q && (
        <div className="hero">
          <div className="auto-hero__text">
            <span className="hero__date">Build it in a sentence</span>
            <span className="auto-hero__title">
              When <em>a reminder goes quiet</em>, tell <em>the right person</em> — before the job slips a cycle.
            </span>
          </div>
          <button className="btn btn--on-dark" onClick={act.newAuto}>
            Build your own
          </button>
        </div>
      )}
      {brands && (
        <section className="auto-section">
          <div className="auto-section__head">
            <span className="t-group">Integrations</span>
            <span className="t-meta">{A.INTEGRATIONS.length} available</span>
          </div>
          <div className="brands">
            {A.INTEGRATIONS.map((i) => (
              <button key={i.name} className={`brand${i.line ? " brand--line" : ""}`} style={{ background: i.bg, color: i.color }}>
                {i.name}
                <small>{i.connected ? "Connected" : "Not connected"}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {basics.length > 0 && (
        <section className="auto-section">
          <span className="t-group">Start with the basics</span>
          <div className="recipes">{basics.map(card)}</div>
        </section>
      )}
      {more.length > 0 && (
        <section className="auto-section">
          <div className="auto-section__head">
            <span className="t-group">More recipes</span>
            <span className="t-meta">{more.length}</span>
          </div>
          <div className="recipes">{more.map(card)}</div>
        </section>
      )}
      {!pool.length && !brands && (
        <div className="empty empty--dashed">
          <span className="empty__title">No recipes match that</span>
          <span className="empty__sub">Build it yourself instead — it only takes a sentence.</span>
          <button className="btn btn--secondary btn--sm" onClick={act.newAuto}>
            Build your own
          </button>
        </div>
      )}
    </>
  );
}
function Builder() {
  const { S, X, set, act, tplNames } = useCaro();
  const r = S.rule!;
  const missing = A.missingCount(r, tplNames);
  const pv = A.preview(r, X, tplNames);
  let pvText = "";
  if (pv) {
    if (pv.kind === "event") pvText = "Runs the moment it happens, on any site in scope. Nothing to preview yet.";
    else if (pv.kind === "schedule") pvText = "Runs on its own schedule and sends one summary, not one per site.";
    else if (pv.hits.length) {
      const names = pv.hits.slice(0, 3).map((s) => s.name).join(", ");
      pvText = `Today this would run on ${plural(pv.hits.length, "site")}: ${names}${pv.hits.length > 3 ? " and " + (pv.hits.length - 3) + " more" : ""}.`;
    } else pvText = "Nothing matches today." + (pv.soon ? ` ${plural(pv.soon, "site")} reach that point in the next 30 days.` : " It runs as soon as something does.");
  }
  return (
    <div className="container container--narrow">
      <a className="text-btn text-btn--muted" href="#automations" style={{ width: "fit-content", margin: "-8px 0 -10px -6px" }}>
        <Ic d={P.chevL} s={13} sw={2} />
        Automations
      </a>
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">{S.editId ? "Edit automation" : "New automation"}</h1>
          <p className="page-head__sub">Click any underlined part to change it.</p>
        </div>
      </div>
      <div className="card builder-card">
        <div className="builder">
          <div className="builder__sentence">
            {A.ruleParts(r, tplNames).map((p, i) => {
              if (p.t) return <span className="builder__word" key={i}>{p.text}</span>;
              const cls = !p.val ? " bchip--empty" : p.isVerb ? " bchip--verb" : "";
              const open = S.chip === p.key;
              return (
                <span className="bchip-wrap" data-pop key={p.key}>
                  <button className={`bchip${cls}`} onClick={() => set({ chip: open ? null : p.key! })} aria-expanded={open}>
                    {p.val || "choose"}
                    <Ic d={P.chevD} s={11} sw={3} />
                  </button>
                  {open && (
                    <div className="menu" role="listbox">
                      {p.opts!.map((o) => (
                        <div key={o} className="menu__item" role="option" aria-selected={o === p.val} onClick={() => act.choose(p.key!, o, tplNames)}>
                          <span className="menu__tick">{o === p.val && <Ic d={P.check} s={11} sw={3} />}</span>
                          {o}
                        </div>
                      ))}
                    </div>
                  )}
                </span>
              );
            })}
          </div>
          <div className="builder__steps">
            {r.acts.length < A.MAX_ACTIONS && (
              <button
                className="btn btn--quiet"
                onClick={() => {
                  const rule = A.addAction(r);
                  set({ rule, chip: `acts.${rule.acts.length - 1}.verb` });
                }}
              >
                <Ic d={P.plus} s={12} sw={2} />
                And do something else
              </button>
            )}
            {r.acts.length > 1 && (
              <button className="btn btn--danger-text btn--sm" onClick={() => set({ rule: A.dropAction(r), chip: null })}>
                <Ic d={P.minus} s={12} sw={2} />
                Remove last step
              </button>
            )}
          </div>
          {pvText && (
            <div className="auto-preview">
              <Ic d={P.info} s={15} sw={1.7} />
              <span>{pvText}</span>
            </div>
          )}
        </div>
        <div className="builder-card__foot">
          {missing ? (
            <div className="builder__status builder__status--warn">
              <span className="status-dot" style={{ background: "var(--red)" }}>
                <Ic d={P.alert} s={9} sw={2.8} />
              </span>
              {missing === 1 ? "One thing left to choose before this can run." : missing + " things left to choose before this can run."}
            </div>
          ) : (
            <div className="builder__status builder__status--ok">
              <span className="status-dot" style={{ background: "var(--blue-500)" }}>
                <Ic d={P.check} s={9} sw={3.2} />
              </span>
              Ready. Runs on every recurring site in scope.
            </div>
          )}
          <a className="btn btn--neutral btn--md" href="#automations">
            Cancel
          </a>
          <button className="btn btn--primary btn--md" onClick={() => act.saveRule(tplNames)} style={missing ? { opacity: 0.45 } : undefined}>
            {S.editId ? "Save changes" : "Create automation"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- email templates ---------- */
export function MergeChips({ target }: { target: string }) {
  const { act } = useCaro();
  return (
    <div className="merge">
      <span className="t-caption">Insert</span>
      {MERGE_FIELDS.map((f) => (
        <button key={f} className="merge__chip" onMouseDown={(e) => e.preventDefault()} onClick={() => act.insertMerge(f, target)}>
          {f}
        </button>
      ))}
    </div>
  );
}
export function MergeHtml({ text, vals }: { text: string; vals: Record<string, string> }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((seg, i) => {
        const m = seg.match(/^\[([^\]]+)\]$/);
        return m && m[1] in vals ? <mark key={i}>{vals[m[1]]}</mark> : <Fragment key={i}>{seg}</Fragment>;
      })}
    </>
  );
}
function usage(t: Template, S: State) {
  const n = S.rules.filter((v) => v.rule.acts.some((a) => a.verb === "send email" && a.template === t.name)).length;
  const parts: string[] = [];
  if (t.system) parts.push("the reminder sequence");
  if (n) parts.push(plural(n, "automation"));
  return { n, system: !!t.system, text: parts.length ? "Used by " + parts.join(" and ") : "Not used yet" };
}
export function Templates() {
  const { S, X, set, act, mergeFocus } = useCaro();
  const t = S.tpl;
  const src = t && S.templates.find((x) => x.id === t.id);
  if (!t || !src) return null;
  const u = usage(src, S);
  const dirty = act.tplDirty();
  const pool = needList(X).concat(X.filter((s) => !s.d.need)).slice(0, 8);
  const ps = pool.length ? pool[S.previewIdx % pool.length] : null;
  const vals = ps ? mergeVals(ps, ps.d, ME) : {};
  const canDelete = !u.system && !u.n;
  const edit = (k: "name" | "subject" | "body", v: string) => set({ tpl: { ...t, [k]: v } });
  const focus = (path: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (mergeFocus.current = { path, el: e.target });
  return (
    <div className="container">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Email templates</h1>
          <p className="page-head__sub">What goes out to clients. Words in [brackets] fill in for each site.</p>
        </div>
      </div>
      <div className="tpl">
        <nav className="tpl-side">
          <div className="tpl-side__head">
            <span className="t-label">{plural(S.templates.length, "template")}</span>
            <button className="btn btn--quiet" onClick={act.newTpl}>
              <Ic d={P.plus} s={12} sw={2} />
              New
            </button>
          </div>
          {S.templates.map((x) => {
            const cur = x.id === t.id;
            const draft = (!cur && S.tplDrafts[x.id]) || (cur && dirty);
            return (
              <a key={x.id} className="tpl-item" href={`#templates/${x.id}`} aria-current={cur ? "page" : undefined}>
                <span className="tpl-item__name truncate">{cur ? t.name || "Untitled template" : x.name}</span>
                <span className={`tpl-item__sub${draft ? " tpl-item__sub--draft" : ""}`}>{draft ? "Unsaved changes" : usage(x, S).text}</span>
              </a>
            );
          })}
        </nav>
        <div className="card card--raised">
          <div className="tpl-editor__body">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <input className="tpl-name" value={t.name} onChange={(e) => edit("name", e.target.value)} placeholder="Template name" aria-label="Template name" />
              <span className="t-meta">
                {u.text}
                {src.edited ? ` · edited ${src.edited}` : ""}
              </span>
            </div>
            <div className="field">
              <span className="field__label">Subject</span>
              <input data-model="tpl.subject" value={t.subject} onFocus={focus("tpl.subject")} onChange={(e) => edit("subject", e.target.value)} placeholder="What the client sees in their inbox" />
            </div>
            <div className="field">
              <span className="field__label">Message</span>
              <textarea data-model="tpl.body" value={t.body} onFocus={focus("tpl.body")} onChange={(e) => edit("body", e.target.value)} placeholder="Hi [First name]," />
            </div>
            <MergeChips target="tpl.body" />
            {ps && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="preview-head">
                  <span className="t-label">Preview with {ps.name}</span>
                  <button className="text-btn" onClick={() => set({ previewIdx: S.previewIdx + 1 })}>
                    Try another site
                  </button>
                </div>
                <div className="mail-preview">
                  <span className="mail-preview__meta">
                    To {ps.first || ps.contact || "the contact"} · {ps.email || "no email on file"}
                  </span>
                  <span className="mail-preview__subject">
                    <MergeHtml text={t.subject || "No subject"} vals={vals} />
                  </span>
                  <span className="mail-preview__body">
                    <MergeHtml text={t.body} vals={vals} />
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="tpl-editor__foot">
            <span className="t-caption">
              {canDelete ? "The unsubscribe footer is added when it sends." : u.system ? "Built into the reminder sequence, so it can’t be deleted." : "Used by automations — change those before deleting."}
            </span>
            <button
              className="btn btn--danger-text btn--sm"
              disabled={!canDelete}
              onClick={() => set({ confirm: { kind: "tpl", id: t.id, title: "Delete this template?", body: `${t.name}. This can’t be undone.`, cta: "Delete template" } })}
            >
              <Ic d={P.trash} s={12} sw={1.8} />
              Delete
            </button>
            <button className="btn btn--neutral btn--md" onClick={act.dupTpl}>
              <Ic d={P.dup} s={13} sw={1.7} />
              Duplicate
            </button>
            <button className="btn btn--primary btn--md" onClick={act.saveTpl} disabled={!(dirty && t.name.trim())}>
              Save template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- reminder timing ---------- */
export function Timing() {
  const { S, X, set, act } = useCaro();
  const unit = (k: TimingKey, v: number) => `${v} ${TIMING_UNIT[k]}`;
  const Chip = ({ line, k, disabled }: { line: LineKey; k: TimingKey; disabled?: boolean }) => {
    const id = `${line}.${k}`;
    const v = S.timing[line][k] as number;
    const open = S.timingChip === id;
    let opts: readonly number[] = TIMING_OPTIONS[k];
    if (k === "flag") opts = opts.filter((o) => o > S.timing[line].follow);
    return (
      <span className="chip-wrap" data-pop>
        <button className={`rule__chip${disabled ? " is-off" : ""}`} onClick={() => set({ timingChip: open ? null : id })} aria-expanded={open}>
          {unit(k, v)}
          <Ic d={P.chevD} s={9} sw={2.8} />
        </button>
        {open && (
          <div className="menu" role="listbox">
            {opts.map((o) => (
              <div key={o} className="menu__item" role="option" onClick={() => act.setTiming(line, k, o)}>
                <span className="menu__tick">{o === v && <Ic d={P.check} s={11} sw={3} />}</span>
                {unit(k, o)}
              </div>
            ))}
          </div>
        )}
      </span>
    );
  };
  const horizon = addDays(today(), 30);
  return (
    <div className="container container--narrow">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Reminder timing</h1>
          <p className="page-head__sub pretty">How far ahead each service line is chased. Changes apply straight away.</p>
        </div>
      </div>
      {LINES.map((l) => {
        const t = S.timing[l.key];
        const sites = X.filter((s) => s.line === l.key);
        const upcoming = sites.filter((s) => !s.booked && !s.reminded && s.d.remindOn >= today() && s.d.remindOn <= horizon).sort((a, b) => +a.d.remindOn - +b.d.remindOn);
        return (
          <section className="timing-card" key={l.key}>
            <div className="timing-card__head">
              <span className="dot" style={{ "--dot": l.dot } as React.CSSProperties} />
              <span className="t-card" style={{ fontWeight: 600 }}>
                {l.name}
              </span>
              <span className="t-meta">
                {plural(sites.length, "site")} · {money(sites.reduce((a, s) => a + s.d.annual, 0))} a year
              </span>
            </div>
            <div className="timing-card__body">
              <p className="rule">
                Sites repeat every <Chip line={l.key} k="interval" />. Send the reminder <Chip line={l.key} k="lead" /> before it’s due, follow up{" "}
                <Chip line={l.key} k="follow" /> later if there’s no reply, and move it to Needs you after <Chip line={l.key} k="flag" /> without one.
              </p>
              <div className={`timing-card__opt${t.priceCheck ? "" : " is-off"}`}>
                <button className="toggle" role="switch" onClick={() => act.togglePriceCheck(l.key)} aria-checked={t.priceCheck} />
                <span>
                  Flag a price check when the price hasn’t changed in <Chip line={l.key} k="priceYears" disabled={!t.priceCheck} />
                </span>
              </div>
            </div>
            <div className="timing-card__foot">
              <Ic d={P.mail} s={14} sw={1.7} />
              <span>
                {upcoming.length
                  ? `Next 30 days: ${plural(upcoming.length, "reminder")} due, the first on ${fmtS(upcoming[0].d.remindOn)}.`
                  : "No reminders due in the next 30 days."}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
