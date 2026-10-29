"use client";
// components/caro/CaroPage.tsx
//
// Caro (/caro): recurring jobs and client check-in in one tab. Built from the
// design handoff's Recurring jobs reference (one state object, hash routes,
// views + overlays), on real data: every recurring site from SimPRO, matched
// to its client check-in record, with Caro's state saved in Neon.
//
// Routes (hash): #overview · #sites · #sites/hs|wc|bc · #clients · #automations
//   #automations/library · #automations/new · #automations/edit/:id
//   #templates · #templates/:id · #timing
// Overlays (site record, client record, composer, new job, confirm) are state.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./caro.css";
import {
  LINE,
  ME,
  TIMING_OPTIONS,
  addDays,
  derive,
  fmt,
  fmtS,
  iso,
  isLineKey,
  money2,
  parse,
  stateOf,
  today,
  type Chase,
  type LineKey,
  type LogEntry,
  type Site,
  type Template,
  type TimingKey,
  type TimingMap,
} from "@/lib/caro/data";
import * as A from "@/lib/caro/auto";
import type { CheckinRow } from "@/lib/checkin/store";
import { plural, type XSite } from "./helpers";
import { P } from "./icons";
import { SectionMenu, Overview, Sites, Clients, Automations, Templates, Timing } from "./views";
import { SiteRecord, ClientRecord, Composer, NewSite, ConfirmModal, QuoteModal, Toast, SelectionBar } from "./overlays";

/* ---------- state ---------- */
export type View = "overview" | "sites" | "clients" | "automations" | "templates" | "timing";
export interface Compose {
  keys: string[];
  tplId: string;
  subject: string;
  body: string;
  follow: Chase;
  mode: "write" | "preview";
  sending?: boolean;
}
export interface NewSiteForm {
  line: LineKey;
  customer: string;
  address: string;
  suburb: string;
  first: string;
  email: string;
  phone: string;
  price: string;
  interval: number;
  lastDone: string;
  errors: Record<string, string>;
}
export interface Confirm {
  kind: "stop" | "rule" | "tpl";
  id: string;
  icon?: string;
  title: string;
  body: string;
  cta: string;
}
export interface State {
  loading: boolean;
  error: string | null;
  syncing: boolean;
  syncedAt: string | null;
  live: boolean;
  testTo: string;
  view: View;
  line: LineKey | null;
  autoView: "running" | "library" | "builder";
  editId: string | null;
  tplId: string;
  sites: Site[];
  timing: TimingMap;
  templates: Template[];
  rules: A.LiveRule[];
  month: number;
  showAllNeeds: boolean;
  selected: string[];
  search: string;
  status: string;
  sort: string;
  sortOpen: boolean;
  record: string | null;
  recTab: "timeline" | "details";
  recMenu: string | null;
  recDraft: { price: string; interval: number; owner: string } | null;
  focusPrice: boolean;
  client: number | null;
  clientRows: CheckinRow[] | null;
  clientsSyncedAt: string | null;
  clientsError: string | null;
  clientSearch: string;
  clientFilter: string;
  clientSyncing: boolean;
  quote: string | null;
  quoteBusy: boolean;
  compose: Compose | null;
  composeMenu: boolean;
  newSite: NewSiteForm | null;
  confirm: Confirm | null;
  toast: { text: string; undo: boolean } | null;
  cat: string;
  autoSearch: string;
  rule: A.Rule | null;
  chip: string | null;
  tpl: Template | null;
  tplDrafts: Record<string, Template>;
  previewIdx: number;
  timingChip: string | null;
}

const INIT: State = {
  loading: true, error: null, syncing: false, syncedAt: null, live: false, testTo: "",
  view: "overview", line: null, autoView: "running", editId: null, tplId: "t1",
  sites: [], timing: { hs: {} as never, wc: {} as never, bc: {} as never }, templates: [], rules: [],
  month: 1, showAllNeeds: false, selected: [],
  search: "", status: "all", sort: "due", sortOpen: false,
  record: null, recTab: "timeline", recMenu: null, recDraft: null, focusPrice: false,
  client: null, clientRows: null, clientsSyncedAt: null, clientsError: null, clientSearch: "", clientFilter: "all", clientSyncing: false,
  quote: null, quoteBusy: false,
  compose: null, composeMenu: false, newSite: null, confirm: null, toast: null,
  cat: "Explore", autoSearch: "", rule: null, chip: null,
  tpl: null, tplDrafts: {}, previewIdx: 0,
  timingChip: null,
};
const CLOSE_POPS = { sortOpen: false, recMenu: null, composeMenu: false, chip: null, timingChip: null } satisfies Partial<State>;
type Snapshot = Pick<State, "sites" | "rules" | "templates" | "timing">;

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const logEntry = (kind: LogEntry["kind"], title: string, detail = ""): LogEntry => ({ kind, title, detail, date: iso(today()), t: Date.now() });

async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

/* ---------- context ---------- */
interface Ctx {
  S: State;
  X: XSite[];
  set: (p: Partial<State> | ((s: State) => Partial<State>)) => void;
  act: ReturnType<typeof useActions>;
  tplNames: string[];
  ruleHtml: (r: A.Rule) => React.ReactNode;
  mergeFocus: React.MutableRefObject<{ path: string; el: HTMLInputElement | HTMLTextAreaElement } | null>;
}
const CaroCtx = createContext<Ctx | null>(null);
export const useCaro = () => useContext(CaroCtx)!;

/* ---------- actions ---------- */
function useActions(
  SR: React.MutableRefObject<State>,
  set: Ctx["set"],
  X: () => XSite[],
  mergeFocus: Ctx["mergeFocus"],
) {
  const undoSnap = useRef<Snapshot | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = (text: string, snap?: Snapshot) => {
    undoSnap.current = snap ?? null;
    set({ toast: { text, undo: !!snap } });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      undoSnap.current = null;
      set({ toast: null });
    }, 4800);
  };
  const snapshot = (): Snapshot => {
    const S = SR.current;
    return { sites: S.sites, rules: S.rules, templates: S.templates, timing: S.timing };
  };

  /** Apply a change and save whatever differs from what's on screen now. */
  const commit = (next: Partial<State>) => {
    const prev = SR.current;
    set(next);
    const jobs: Promise<unknown>[] = [];
    if (next.sites && next.sites !== prev.sites) {
      const before = new Map(prev.sites.map((s) => [s.key, s]));
      const after = new Set(next.sites.map((s) => s.key));
      for (const s of next.sites) {
        const old = before.get(s.key);
        if (!old || old === s) continue;
        const body: Record<string, unknown> = {};
        if (JSON.stringify(stateOf(old)) !== JSON.stringify(stateOf(s))) body.state = stateOf(s);
        if (old.stopped !== s.stopped) Object.assign(body, { stopped: s.stopped, jobId: s.jobId });
        if (Object.keys(body).length) jobs.push(api(`/api/caro/sites/${encodeURIComponent(s.key)}`, "PATCH", body));
      }
      for (const s of prev.sites) if (!after.has(s.key) && s.source === "manual") jobs.push(api(`/api/caro/sites/${encodeURIComponent(s.key)}`, "DELETE"));
    }
    const settings: Record<string, unknown> = {};
    if (next.timing && next.timing !== prev.timing) settings.timing = next.timing;
    if (next.templates && next.templates !== prev.templates) settings.templates = next.templates;
    if (next.rules && next.rules !== prev.rules) settings.rules = next.rules;
    if (Object.keys(settings).length) jobs.push(api("/api/caro/settings", "PUT", settings));
    Promise.all(jobs).catch((err) => toast(`Couldn’t save: ${err instanceof Error ? err.message : "check your connection"}.`));
  };
  const patchSites = (keys: string[], fn: (s: Site) => Site) => {
    const k = new Set(keys);
    return SR.current.sites.map((s) => (k.has(s.key) ? fn(s) : s));
  };

  const load = async (quiet = false) => {
    if (!quiet) set({ loading: true, error: null });
    try {
      const data = await api<{ sites: Site[]; syncedAt: string | null; timing: TimingMap; templates: Template[]; rules: A.LiveRule[]; live: boolean; testTo: string }>("/api/caro");
      set({ ...data, loading: false, error: null });
      if (SR.current.view === "templates" && !SR.current.tpl) route();
      return true;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Could not load." });
      return false;
    }
  };
  const loadClients = async () => {
    set({ clientsError: null });
    try {
      const data = await api<{ rows: CheckinRow[]; syncedAt: string | null }>("/api/checkin");
      set({ clientRows: data.rows, clientsSyncedAt: data.syncedAt });
    } catch (err) {
      set({ clientsError: err instanceof Error ? err.message : "Could not load clients." });
    }
  };

  /* ---------- routing ---------- */
  const tplDirty = () => {
    const S = SR.current;
    if (!S.tpl) return false;
    const t = S.templates.find((x) => x.id === S.tpl!.id);
    return !!t && (t.name !== S.tpl.name || t.subject !== S.tpl.subject || t.body !== S.tpl.body);
  };
  function route() {
    const S = SR.current;
    const h = (window.location.hash || "#overview").slice(1).split("/");
    const p: Partial<State> = { selected: [], ...CLOSE_POPS };
    if (h[0] === "sites") Object.assign(p, { view: "sites", line: isLineKey(h[1]) ? h[1] : null, status: "all" });
    else if (h[0] === "clients") p.view = "clients";
    else if (h[0] === "automations") {
      p.view = "automations";
      if (h[1] === "library") p.autoView = "library";
      else if (h[1] === "new") {
        p.autoView = "builder";
        if (!S.rule || S.editId) {
          p.rule = A.newRule();
          p.chip = "subject";
        } else p.chip = S.chip;
        p.editId = null;
      } else if (h[1] === "edit" && S.rules.some((v) => v.id === h[2])) {
        p.autoView = "builder";
        if (S.editId !== h[2] || !S.rule) p.rule = A.clone(S.rules.find((v) => v.id === h[2])!.rule);
        p.editId = h[2];
      } else p.autoView = "running";
    } else if (h[0] === "templates") {
      p.view = "templates";
      if (S.templates.length) {
        const id = S.templates.some((t) => t.id === h[1]) ? h[1] : S.templates.some((t) => t.id === S.tplId) ? S.tplId : S.templates[0].id;
        if (S.tpl && S.tpl.id !== id && tplDirty()) p.tplDrafts = { ...S.tplDrafts, [S.tpl.id]: S.tpl };
        if (!S.tpl || S.tpl.id !== id) {
          p.tpl = S.tplDrafts[id] || clone(S.templates.find((t) => t.id === id)!);
          p.previewIdx = 0;
        }
        p.tplId = id;
      }
    } else if (h[0] === "timing") p.view = "timing";
    else p.view = "overview";
    const changed = p.view !== S.view || p.line !== S.line || p.autoView !== S.autoView;
    set(p);
    if (p.view === "clients" && !SR.current.clientRows) loadClients();
    if (changed) document.querySelector(".caro-root")?.closest("main")?.scrollTo({ top: 0 });
  }
  const go = (hash: string) => {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  };

  /* ---------- sites ---------- */
  const openRecord = (key: string, tab: State["recTab"] = "timeline") => {
    const s = SR.current.sites.find((x) => x.key === key);
    if (!s) return;
    set({ ...CLOSE_POPS, client: null, record: key, recTab: tab, recMenu: null, recDraft: { price: String(s.price), interval: s.interval, owner: s.owner } });
  };
  const openCompose = (keys: string[]) => {
    const S = SR.current;
    const sites = X().filter((s) => keys.includes(s.key));
    const allReminded = sites.length > 0 && sites.every((s) => s.reminded);
    const tpl = S.templates.find((t) => t.system === (allReminded ? "follow" : "reminder")) || S.templates[0];
    if (!tpl) return;
    set({ ...CLOSE_POPS, compose: { keys: sites.map((s) => s.key), tplId: tpl.id, subject: tpl.subject, body: tpl.body, follow: "follow", mode: "write" } });
  };
  const book = (keys: string[], detail = "") => {
    const fresh = keys.filter((k) => {
      const s = SR.current.sites.find((x) => x.key === k);
      return s && !s.booked;
    });
    if (!fresh.length) return;
    const snap = snapshot();
    const sites = patchSites(fresh, (s) => ({ ...s, booked: iso(today()), snoozedUntil: null, flagged: false, log: [...s.log, logEntry("booked", "Booked", detail)] }));
    const one = sites.find((s) => s.key === fresh[0])!;
    commit({ sites, selected: [] });
    toast(fresh.length === 1 ? `${one.name} booked.` : `${fresh.length} booked.`, snap);
  };

  const sync = async () => {
    set({ syncing: true });
    try {
      await api("/api/caro/sync", "POST");
      await load(true);
      toast("Synced with SimPRO.");
    } catch (err) {
      toast(`Sync failed: ${err instanceof Error ? err.message : "try again"}.`);
    } finally {
      set({ syncing: false });
    }
  };

  const insertMerge = (field: string, fallbackPath: string) => {
    const token = `[${field}]`;
    const f = mergeFocus.current;
    const path = f && document.activeElement === f.el ? f.path : fallbackPath;
    const el = f && f.path === path ? f.el : null;
    const [obj, key] = path.split(".") as ["tpl" | "compose", "subject" | "body"];
    const holder = SR.current[obj];
    if (!holder) return;
    const val = holder[key];
    const s0 = el && document.activeElement === el ? (el.selectionStart ?? val.length) : val.length;
    const s1 = el && document.activeElement === el ? (el.selectionEnd ?? val.length) : val.length;
    set({ [obj]: { ...holder, [key]: val.slice(0, s0) + token + val.slice(s1) } } as Partial<State>);
    requestAnimationFrame(() => {
      const again = document.querySelector<HTMLInputElement>(`[data-model="${path}"]`);
      if (again) {
        again.focus();
        again.setSelectionRange(s0 + token.length, s0 + token.length);
      }
    });
  };

  return {
    toast,
    load,
    loadClients,
    route,
    go,
    tplDirty,
    insertMerge,
    sync,
    undo: () => {
      const snap = undoSnap.current;
      undoSnap.current = null;
      set({ toast: null });
      if (snap) commit(snap);
    },

    // overview + sites
    toggleNeeds: () => set({ showAllNeeds: !SR.current.showAllNeeds }),
    pickMonth: (i: number) => set({ month: i, selected: [] }),
    setSelected: (keys: string[]) => set({ selected: keys }),
    select: (key: string) => {
      const sel = SR.current.selected;
      set({ selected: sel.includes(key) ? sel.filter((x) => x !== key) : [...sel, key] });
    },
    clearSelection: () => set({ selected: [] }),
    bulkRemind: () => openCompose(SR.current.selected),
    bulkBook: () => book(SR.current.selected),
    clearSiteFilters: () => set({ search: "", status: "all" }),

    // site record
    openRecord,
    reviewPrice: (key: string) => {
      openRecord(key, "details");
      set({ focusPrice: true });
    },
    closeRecord: () => set({ record: null, recMenu: null }),
    bookOne: () => SR.current.record && book([SR.current.record]),
    unbook: () => {
      const key = SR.current.record!;
      const snap = snapshot();
      commit({ recMenu: null, sites: patchSites([key], (s) => ({ ...s, booked: null, log: [...s.log, logEntry("note", "Booking cleared")] })) });
      toast("Booking cleared.", snap);
    },
    logCall: (how: "booked" | "later" | "none" | "replied") => {
      const s = SR.current.sites.find((x) => x.key === SR.current.record)!;
      const who = s.first || s.contact || "them";
      const snap = snapshot();
      const title = {
        booked: `Called ${who} — booked it`,
        later: `Called ${who} — call back in 2 weeks`,
        none: `Called ${who} — no answer`,
        replied: `${who} replied — waiting on a date`,
      }[how];
      const sites = patchSites([s.key], (x) => ({
        ...x,
        log: [...x.log, logEntry(how === "replied" ? "reply" : "call", title, "Logged by " + ME.first)],
        reminded: how === "replied" && x.reminded ? { ...x.reminded, replied: true } : x.reminded,
        flagged: how === "replied" ? false : x.flagged,
        snoozedUntil: how === "later" ? iso(addDays(today(), 14)) : how === "none" ? iso(addDays(today(), 2)) : x.snoozedUntil,
      }));
      set({ recMenu: null });
      if (how === "booked") {
        SR.current = { ...SR.current, sites };
        book([s.key], "From a call");
        return;
      }
      commit({ sites });
      toast(
        how === "later"
          ? `Logged. ${s.name} comes back on ${fmtS(addDays(today(), 14))}.`
          : how === "none"
            ? `Logged. Back in Needs you on ${fmtS(addDays(today(), 2))} if there’s no booking.`
            : "Logged.",
        snap,
      );
    },
    snooze: () => {
      const key = SR.current.record!;
      const s = SR.current.sites.find((x) => x.key === key)!;
      const until = addDays(today(), 30);
      const snap = snapshot();
      commit({
        recMenu: null,
        record: null,
        sites: patchSites([key], (x) => ({ ...x, snoozedUntil: iso(until), log: [...x.log, logEntry("snooze", "Snoozed 30 days", "Until " + fmt(until))] })),
      });
      toast(`${s.name} snoozed until ${fmtS(until)}.`, snap);
    },
    askStop: () => {
      const s = SR.current.sites.find((x) => x.key === SR.current.record)!;
      set({ recMenu: null, confirm: { kind: "stop", id: s.key, icon: P.stop, title: `Stop recurring for ${s.name}?`, body: "It drops off reminders and Needs you. Its past jobs stay in SimPRO.", cta: "Stop recurring" } });
    },
    resetRecDraft: () => {
      const s = SR.current.sites.find((x) => x.key === SR.current.record)!;
      set({ recDraft: { price: String(s.price), interval: s.interval, owner: s.owner } });
    },
    saveRecDraft: () => {
      const S = SR.current;
      const s = S.sites.find((x) => x.key === S.record)!;
      const dr = S.recDraft!;
      const price = Math.round(Number(String(dr.price).replace(/[$,\s]/g, "")) * 100) / 100;
      const interval = Number(dr.interval);
      if (!(price > 0)) return;
      const snap = snapshot();
      const log = [...s.log];
      const ov = { ...(s.ov ?? {}) };
      if (price !== s.price) {
        log.push(logEntry("price", "Price updated", money2(s.price) + " → " + money2(price)));
        ov.price = price;
        ov.priceSince = today().getFullYear();
      }
      if (interval !== s.interval) {
        log.push(logEntry("note", "Repeat changed", `Every ${s.interval} months → every ${interval} months`));
        ov.interval = interval;
      }
      if (dr.owner !== s.owner) {
        log.push(logEntry("note", "Owner changed", dr.owner));
        ov.owner = dr.owner;
      }
      const sites = patchSites([s.key], (x) => ({
        ...x,
        ov,
        price,
        interval,
        owner: dr.owner,
        priceSince: ov.priceSince ?? x.priceSince,
        nextDue: interval !== x.interval ? null : x.nextDue,
        log,
      }));
      commit({ sites, recDraft: { price: String(price), interval, owner: dr.owner } });
      toast("Changes saved.", snap);
    },

    // SimPRO quote (the old Recurring jobs page's main action)
    openQuote: (key: string) => set({ ...CLOSE_POPS, quote: key }),
    closeQuote: () => set({ quote: null }),
    createQuote: async () => {
      const S = SR.current;
      const s = S.sites.find((x) => x.key === S.quote);
      if (!s) return;
      set({ quoteBusy: true });
      try {
        const r = await api<{ quoteName: string }>("/api/simpro/recertifications/create-quote", "POST", {
          category: LINE[s.line].category,
          customerId: s.customerId,
          siteId: s.siteId,
          siteName: s.name,
          customer: s.customer,
          lastExTax: s.price,
          nextDueDate: iso(derive(s, S.timing[s.line]).next),
        });
        set({ quote: null, quoteBusy: false });
        if (!s.booked) book([s.key], `Quote created in SimPRO · ${r.quoteName}`);
        toast(`Quote created — ${r.quoteName}`);
      } catch (err) {
        set({ quoteBusy: false });
        toast(`Couldn’t create the quote: ${err instanceof Error ? err.message : "try again"}.`);
      }
    },

    // composer
    composeOne: (key: string) => openCompose([key]),
    closeCompose: () => set({ compose: null, composeMenu: false }),
    send: async () => {
      const c = SR.current.compose;
      if (!c || c.sending || !c.keys.length || !c.body.trim() || !c.subject.trim()) return;
      set({ compose: { ...c, sending: true } });
      try {
        const r = await api<{ live: boolean; sent: string[]; skipped: { name: string; reason: string }[]; sentTo?: string }>("/api/caro/reminders", "POST", {
          keys: c.keys,
          subject: c.subject,
          body: c.body,
          chase: c.follow,
        });
        set({ compose: null, selected: [] });
        const skipped = r.skipped.length ? ` ${plural(r.skipped.length, "site")} skipped (${[...new Set(r.skipped.map((x) => x.reason.toLowerCase()))].join(", ")}).` : "";
        if (!r.live) toast(r.sentTo ? `Test mode: one sample went to ${r.sentTo}. Nothing recorded.${skipped}` : `Nothing sent.${skipped}`);
        else {
          await load(true);
          toast(`${r.sent.length === 1 ? "Reminder" : r.sent.length + " reminders"} sent.${skipped}`);
        }
      } catch (err) {
        set({ compose: { ...c, sending: false } });
        toast(`Couldn’t send: ${err instanceof Error ? err.message : "try again"}.`);
      }
    },

    // new recurring job
    openNew: () => {
      const line = SR.current.line || "hs";
      set({ newSite: { line, customer: "", address: "", suburb: "", first: "", email: "", phone: "", price: "", interval: SR.current.timing[line].interval, lastDone: iso(today()), errors: {} } });
    },
    addSite: async () => {
      const f = SR.current.newSite!;
      const e: Record<string, string> = {};
      if (!f.customer.trim()) e.customer = "Give the site a name.";
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Add an email so reminders can go out.";
      const price = Number(String(f.price).replace(/[$,\s]/g, ""));
      if (!(price > 0)) e.price = "Add the price you charge each time.";
      if (!f.lastDone) e.lastDone = "When was it last done?";
      if (Object.keys(e).length) return set({ newSite: { ...f, errors: e } });
      const year = today().getFullYear();
      const site: Site = {
        key: "m:" + Date.now(), source: "manual", line: f.line, jobId: 0, siteId: 0, customerId: 0,
        customer: f.customer.trim(), name: f.customer.trim(), first: f.first.trim(), contact: f.first.trim(), email: f.email.trim(), phone: f.phone.trim(),
        address: f.address.trim(), suburb: f.suburb.trim(), interval: Number(f.interval), lastDone: f.lastDone, nextDue: null,
        price, priceSince: year, since: year, owner: ME.initials, stopped: false, ltv: 0, history: [], blockers: [], doNotSend: false, checkinId: null,
        booked: null, reminded: null, chase: "follow", snoozedUntil: null, log: [logEntry("note", "Added to Caro", "By " + ME.name)],
      };
      try {
        await api("/api/caro/sites", "POST", { site });
      } catch (err) {
        return set({ newSite: { ...f, errors: { customer: err instanceof Error ? err.message : "Could not add it." } } });
      }
      const snap = snapshot();
      set({ sites: [site, ...SR.current.sites], newSite: null });
      const d = derive(site, SR.current.timing[site.line]);
      toast(d.remindOn <= today() ? `${site.name} added. It’s due soon, so it’s in Needs you.` : `${site.name} added. First reminder ${fmtS(d.remindOn)}.`, snap);
    },

    // confirm
    doConfirm: () => {
      const c = SR.current.confirm!;
      const snap = snapshot();
      set({ confirm: null });
      if (c.kind === "stop") {
        const s = SR.current.sites.find((x) => x.key === c.id)!;
        commit({ sites: patchSites([c.id], (x) => ({ ...x, stopped: true })), record: null, selected: SR.current.selected.filter((x) => x !== c.id) });
        toast(`${s.name} is no longer recurring.`, snap);
      } else if (c.kind === "rule") {
        commit({ rules: SR.current.rules.filter((v) => v.id !== c.id) });
        toast("Automation deleted.", snap);
      } else if (c.kind === "tpl") {
        const drafts = { ...SR.current.tplDrafts };
        delete drafts[c.id];
        const templates = SR.current.templates.filter((t) => t.id !== c.id);
        commit({ templates, tplDrafts: drafts, tpl: null });
        toast("Template deleted.", snap);
        go("#templates/" + templates[0].id);
      }
    },

    // automations
    newAuto: () => {
      set({ rule: A.newRule(), chip: "subject", editId: null });
      go("#automations/new");
    },
    useRecipe: (id: string) => {
      set({ rule: A.clone(A.RECIPES.find((r) => r.id === id)!.rule), chip: null, editId: null });
      go("#automations/new");
    },
    choose: (key: string, val: string, names: string[]) => {
      const rule = A.setChoice(SR.current.rule!, key, val, names);
      const next = A.ruleParts(rule, names).find((p) => !p.t && !p.val); // fill the sentence left to right
      set({ rule, chip: next ? next.key! : null });
    },
    saveRule: (names: string[]) => {
      const S = SR.current;
      if (A.missingCount(S.rule!, names)) return toast("Finish the highlighted choices first.");
      const editing = S.editId;
      const rules = editing
        ? S.rules.map((v) => (v.id === editing ? { ...v, rule: S.rule!, last: "Edited just now" } : v))
        : [{ id: "v" + Date.now(), on: true, owner: ME.initials, last: "Never run yet", rule: S.rule! }, ...S.rules];
      commit({ rules, rule: null, editId: null, chip: null });
      toast(editing ? "Automation updated." : "Automation is live.");
      go("#automations");
    },
    toggleRule: (id: string) =>
      commit({ rules: SR.current.rules.map((v) => (v.id === id ? { ...v, on: !v.on, last: v.on ? "Paused just now" : "Turned on just now" } : v)) }),
    editRule: (id: string) => {
      const v = SR.current.rules.find((x) => x.id === id)!;
      set({ rule: A.clone(v.rule), editId: v.id, chip: null });
      go("#automations/edit/" + v.id);
    },
    askDeleteRule: (id: string, text: string) =>
      set({ confirm: { kind: "rule", id, title: "Delete this automation?", body: `“${text}.” It stops running straight away.`, cta: "Delete automation" } }),

    // templates
    newTpl: () => {
      const t: Template = { id: "t" + Date.now(), name: "Untitled template", edited: "just now", subject: "", body: "Hi [First name],\n\n\n\n[Your name]" };
      commit({ templates: [...SR.current.templates, t] });
      go("#templates/" + t.id);
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".tpl-name")?.select());
    },
    saveTpl: () => {
      const S = SR.current;
      const t = S.tpl!;
      const old = S.templates.find((x) => x.id === t.id)!;
      const name = t.name.trim();
      if (!name) return;
      const snap = snapshot();
      const edited = fmt(today());
      const templates = S.templates.map((x) => (x.id === t.id ? { ...x, name, subject: t.subject, body: t.body, edited } : x));
      const rules =
        old.name !== name
          ? S.rules.map((v) => ({ ...v, rule: { ...v.rule, acts: v.rule.acts.map((a) => (a.template === old.name ? { ...a, template: name } : a)) } }))
          : S.rules;
      const drafts = { ...S.tplDrafts };
      delete drafts[t.id];
      commit({ templates, rules, tpl: { ...t, name }, tplDrafts: drafts });
      toast("Template saved.", snap);
    },
    dupTpl: () => {
      const t = SR.current.tpl!;
      const copy: Template = { id: "t" + Date.now(), name: t.name + " copy", edited: "just now", subject: t.subject, body: t.body };
      commit({ templates: [...SR.current.templates, copy] });
      toast("Duplicated. You’re editing the copy.");
      go("#templates/" + copy.id);
    },

    // timing
    setTiming: (line: LineKey, k: TimingKey, v: number) => {
      const t = { ...SR.current.timing[line], [k]: v };
      if (k === "follow" && t.flag <= v) t.flag = TIMING_OPTIONS.flag.find((o) => o > v) || t.flag;
      const timing = { ...SR.current.timing, [line]: t };
      if (k === "interval") {
        // Due dates for the whole line move with it, so reload them from the server.
        set({ timing, timingChip: null });
        api("/api/caro/settings", "PUT", { timing })
          .then(() => load(true))
          .then(() => toast("Timing saved. Due dates updated."))
          .catch(() => toast("Couldn’t save the timing."));
        return;
      }
      commit({ timing, timingChip: null });
      toast("Timing saved.");
    },
    togglePriceCheck: (line: LineKey) => {
      commit({ timing: { ...SR.current.timing, [line]: { ...SR.current.timing[line], priceCheck: !SR.current.timing[line].priceCheck } } });
      toast("Timing saved.");
    },

    // clients (check-in)
    openClient: (id: number) => set({ ...CLOSE_POPS, record: null, client: id }),
    closeClient: () => set({ client: null }),
    syncClients: async () => {
      set({ clientSyncing: true });
      try {
        await api("/api/checkin/sync", "POST");
        await Promise.all([loadClients(), load(true)]);
        toast("Clients refreshed from SimPRO.");
      } catch (err) {
        toast(`Refresh failed: ${err instanceof Error ? err.message : "try again"}.`);
      } finally {
        set({ clientSyncing: false });
      }
    },
  };
}

/* ---------- page ---------- */
export default function CaroPage() {
  const SR = useRef<State>(INIT);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const set = useCallback<Ctx["set"]>((p) => {
    SR.current = { ...SR.current, ...(typeof p === "function" ? p(SR.current) : p) };
    force();
  }, []);
  const S = SR.current;
  const X = useMemo<XSite[]>(
    () => (S.loading ? [] : S.sites.filter((s) => !s.stopped).map((s) => ({ ...s, d: derive(s, S.timing[s.line]) }))),
    [S.sites, S.timing, S.loading],
  );
  const XR = useRef(X);
  XR.current = X;
  const mergeFocus = useRef<Ctx["mergeFocus"]["current"]>(null);
  const act = useActions(SR, set, () => XR.current, mergeFocus);
  const tplNames = useMemo(() => S.templates.map((t) => t.name), [S.templates]);
  const ruleHtml = useCallback(
    (r: A.Rule) =>
      A.ruleParts(r, tplNames).map((p, i) => (p.t ? <span key={i}>{p.text} </span> : <b key={i}>{(p.val || "…") + " "}</b>)),
    [tplNames],
  );
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);

  // First load, routing, and the deep link from the due-soon emails
  // (?action=quote&category=…&siteId=…), which used to open /recurring-jobs.
  useEffect(() => {
    setMenuEl(document.getElementById("caro-section-menu"));
    act.route();
    act.load().then((ok) => {
      if (!ok) return;
      const q = new URLSearchParams(window.location.search);
      if (q.get("action") === "quote") {
        const line = Object.values(LINE).find((l) => l.category === q.get("category"));
        const key = line && `${line.key}:${q.get("siteId")}`;
        if (key && SR.current.sites.some((s) => s.key === key)) act.openQuote(key);
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }
    });
    const onHash = () => act.route();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close menus on outside click; Escape closes the top-most thing.
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-pop]")) return;
      const s = SR.current;
      if (s.sortOpen || s.recMenu || s.composeMenu || s.chip || s.timingChip) set(CLOSE_POPS);
    };
    const key = (e: KeyboardEvent) => {
      const s = SR.current;
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (s.compose) return void act.send();
        if (s.view === "templates" && act.tplDirty()) return void act.saveTpl();
      }
      if (e.key !== "Escape") return;
      if (s.sortOpen || s.recMenu || s.composeMenu || s.chip || s.timingChip) return set(CLOSE_POPS);
      if (s.confirm) return set({ confirm: null });
      if (s.quote) return set({ quote: null });
      if (s.compose) return set({ compose: null });
      if (s.newSite) return set({ newSite: null });
      if (s.client) return set({ client: null });
      if (s.record) return set({ record: null });
      if (s.selected.length) return set({ selected: [] });
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!S.focusPrice || S.recTab !== "details") return;
    set({ focusPrice: false });
    const el = document.querySelector<HTMLInputElement>('[data-focus="recPrice"]');
    el?.focus();
    el?.select();
  });

  const ctx: Ctx = { S, X, set, act, tplNames, ruleHtml, mergeFocus };
  const body = S.error ? (
    <div className="container">
      <div className="empty empty--dashed">
        <span className="empty__title">Couldn’t load recurring jobs</span>
        <span className="empty__sub">{S.error}</span>
        <button className="btn btn--neutral btn--sm" onClick={() => act.load()}>
          Try again
        </button>
      </div>
    </div>
  ) : S.view === "clients" ? (
    <Clients />
  ) : S.loading ? (
    <Loading />
  ) : S.view === "sites" ? (
    <Sites />
  ) : S.view === "automations" ? (
    <Automations />
  ) : S.view === "templates" ? (
    <Templates />
  ) : S.view === "timing" ? (
    <Timing />
  ) : (
    <Overview />
  );

  return (
    <CaroCtx.Provider value={ctx}>
      {menuEl &&
        createPortal(
          <div className="caro caro-menu">
            <SectionMenu />
          </div>,
          menuEl,
        )}
      <div className="caro caro-root">
        {body}
        <SelectionBar />
        {!S.loading && (
          <>
            <SiteRecord />
            <ClientRecord />
            <Composer />
            <NewSite />
            <QuoteModal />
            <ConfirmModal />
          </>
        )}
        <Toast />
      </div>
    </CaroCtx.Provider>
  );
}

function Loading() {
  return (
    <div className="container">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Caro</h1>
          <p className="page-head__sub">Loading every recurring site from SimPRO…</p>
        </div>
      </div>
      <div className="needs">
        {[62, 48, 70, 54, 40].map((w, i) => (
          <div className="need" key={i} style={{ cursor: "default" }}>
            <span className="sk sk--tile" />
            <div className="need__main" style={{ gap: 7 }}>
              <span className="sk sk--title" style={{ width: `${w}%` }} />
              <span className="sk sk--line" style={{ width: "40%" }} />
            </div>
            <span className="sk sk--line" style={{ width: 90 }} />
            <span className="sk sk--title" style={{ width: 54, justifySelf: "end" }} />
            <span className="sk sk--title" style={{ width: 110, height: 32, justifySelf: "end" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

