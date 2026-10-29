// components/caro/helpers.ts — display logic shared by Caro's views:
// status labels, Needs-you reasons, the next-step sentence and the timeline.

import {
  LINE,
  addDays,
  fmt,
  fmtS,
  iso,
  money2,
  parse,
  type Derived,
  type LogEntry,
  type Site,
  type TimingMap,
} from "@/lib/caro/data";
import { P } from "./icons";

export type XSite = Site & { d: Derived };

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : many || one + "s"}`;
export const initials = (n: string) =>
  n
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const telHref = (p: string) => "tel:" + p.replace(/[^\d+]/g, "");
export const firstOr = (s: Site) => s.first || s.contact || "them";

export function statusOf(s: XSite): { label: string; pill: string; text: string; tone: string } {
  const d = s.d;
  switch (d.status) {
    case "booked":
      return { label: "Booked", pill: "booked", text: "Booked " + fmtS(parse(s.booked!)), tone: "blue" };
    case "needs":
      return { label: "Needs you", pill: "overdue", text: "Needs you", tone: "red" };
    case "snoozed":
      return { label: "Snoozed", pill: "neutral", text: "Snoozed to " + fmtS(parse(s.snoozedUntil!)), tone: "muted" };
    case "reminded": {
      const r = s.reminded!;
      if (r.replied) return { label: "Replied", pill: "sent", text: "Replied — book a date", tone: "blue" };
      const ago = d.sentAgo ? d.sentAgo + "d ago" : "today";
      return { label: "Reminded " + ago, pill: "sent", text: "Reminded " + ago + (r.opened ? " · opened" : ""), tone: "muted" };
    }
    case "due":
      return { label: "Due in " + d.days + "d", pill: "due", text: "Reminder goes out today", tone: "amber" };
    default:
      return { label: "Reminder " + fmtS(d.remindOn), pill: "neutral", text: "Auto-reminder " + fmtS(d.remindOn), tone: "muted" };
  }
}

export interface NeedInfo {
  icon: string;
  tone: "call" | "send" | "price";
  reason: string;
  action: string;
  act: "openRecord" | "composeOne" | "reviewPrice";
}
export function needOf(s: XSite): NeedInfo | null {
  const d = s.d;
  const r = s.reminded;
  const who = firstOr(s);
  switch (d.need) {
    case "opened":
      return { icon: P.phone, tone: "call", reason: `${who} opened your reminder ${r!.opened} times but hasn’t replied`, action: "Call " + who, act: "openRecord" };
    case "quiet":
      return {
        icon: P.phone,
        tone: "call",
        reason: r ? `No reply in ${d.sentAgo} days · ${d.days < 0 ? "overdue " + -d.days + " days" : "due " + fmtS(d.next)}` : "Flagged for a call",
        action: "Call " + who,
        act: "openRecord",
      };
    case "overdue":
      return { icon: P.mail, tone: "send", reason: `Overdue ${-d.days} days — no reminder went out`, action: "Send reminder", act: "composeOne" };
    case "unsent":
      return { icon: P.mail, tone: "send", reason: `Due ${fmtS(d.next)} — no reminder sent yet`, action: "Send reminder", act: "composeOne" };
    case "price":
      return { icon: P.tag, tone: "price", reason: `Price unchanged since ${s.priceSince} · reminder goes out ${fmtS(d.remindOn)}`, action: "Review price", act: "reviewPrice" };
    default:
      return null;
  }
}
const NEED_RANK = { opened: 0, quiet: 1, overdue: 2, unsent: 3, price: 4 } as const;
export const needList = (X: XSite[]) =>
  X.filter((s) => s.d.need).sort((a, b) => NEED_RANK[a.d.need!] - NEED_RANK[b.d.need!] || b.price - a.price);

export function nextStep(s: XSite, timing: TimingMap): string {
  const d = s.d;
  const r = s.reminded;
  const t = timing[s.line];
  const who = firstOr(s);
  switch (d.need) {
    case "opened":
      return `${who} has opened the reminder ${r!.opened} times. A quick call usually books it.`;
    case "quiet":
      return r ? `No reply in ${d.sentAgo} days. Give ${who} a call — it’s often sitting in an inbox.` : `Flagged for a call. Give ${who} a ring.`;
    case "overdue":
      return `Overdue by ${-d.days} days and no reminder went out. Send one now, or call ${who}.`;
    case "unsent":
      return `Due ${fmt(d.next)} and no reminder has gone out yet. Send one now.`;
    case "price":
      return `The price was last set in ${s.priceSince}. Check it before the reminder goes out on ${fmtS(d.remindOn)}.`;
  }
  if (s.booked) return `Booked on ${fmt(parse(s.booked))}. Nothing to do until it’s done — it comes back round when the next job is completed in SimPRO.`;
  if (d.snoozed) return `Snoozed until ${fmt(parse(s.snoozedUntil!))}. It comes back to Needs you then if there’s still no booking.`;
  if (r?.replied) return `${who} replied. Book a date to close it out.`;
  if (r)
    return s.chase === "none"
      ? `Reminder sent ${d.sentAgo} days ago. You chose not to follow up.`
      : r.followups
        ? `Followed up. If there’s no reply by ${fmtS(addDays(parse(r.at), t.flag))}, it moves to Needs you.`
        : `Reminder sent ${d.sentAgo ? d.sentAgo + " days ago" : "today"}. A follow-up is due after ${t.follow} days if there’s no reply.`;
  return `Nothing to do. The reminder is due to go out on ${fmt(d.remindOn)}.`;
}

/** Log entries, the current reminder and real past visits from SimPRO, newest first. */
export function timelineFor(s: XSite, timing: TimingMap): LogEntry[] {
  const t = timing[s.line];
  const items: LogEntry[] = s.log.map((e) => ({ ...e }));
  if (s.booked && !s.log.some((e) => e.kind === "booked")) items.push({ kind: "booked", title: "Booked", detail: "", date: s.booked, t: 0 });
  if (s.reminded) {
    const at = parse(s.reminded.at);
    if (s.reminded.followups && !s.log.some((e) => e.title === "Follow-up sent" && e.date >= s.reminded!.at))
      items.push({ kind: "email", title: "Follow-up sent", detail: s.reminded.opened ? "opened" : "not opened", date: iso(addDays(at, t.follow)), t: 0 });
    items.push({ kind: "email", title: "Reminder sent", detail: s.email + (s.reminded.opened ? ` · opened ${s.reminded.opened}×` : " · not opened yet"), date: s.reminded.at, t: 0 });
  }
  const past = s.history.length ? s.history.slice(0, 6) : [{ id: s.jobId, date: s.lastDone, desc: "", value: s.price }];
  for (const h of past) {
    items.push({ kind: "done", title: `${cap(LINE[s.line].service)} · ${money2(h.value)}`, detail: [h.id ? `Job #${h.id}` : "", h.desc].filter(Boolean).join(" · "), date: h.date, t: 0 });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.t - a.t);
}
export const TL_ICON: Record<LogEntry["kind"], [string, string]> = {
  email: [P.mail, "blue"],
  reply: [P.reply, "green"],
  call: [P.phone, "blue"],
  booked: [P.cal, "green"],
  done: [P.check, ""],
  price: [P.tag, "amber"],
  snooze: [P.clock, ""],
  note: [P.note, ""],
};
