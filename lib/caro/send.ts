// lib/caro/send.ts
//
// Sends Caro reminders through the same pipe as customer outreach: from Sam,
// with the Spam Act unsubscribe footer + headers, skipping suppressed and
// do-not-send addresses. Test mode is the default (lib/outreach/email.ts):
// one sample, merged for the first site, goes to OUTREACH_TEST_TO, and
// nothing is recorded against any site. Customers are only emailed when
// OUTREACH_LIVE=true.

import { getResend } from "@/lib/crm/email";
import {
  OUTREACH_FROM,
  OUTREACH_REPLY_TO,
  OUTREACH_TEST_TO,
  buildOutreachEmail,
  isOutreachLive,
  unsubscribeHeaders,
} from "@/lib/outreach/email";
import { getSuppressedEmails } from "@/lib/outreach/store";
import { ME, derive, iso, merge, mergeVals, stateOf, today, type Chase, type Site, type SiteState, type TimingMap } from "./data";
import { recordMessage, saveSiteState } from "./store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SendResult {
  live: boolean;
  sent: string[];
  skipped: { key: string; name: string; reason: string }[];
  sentTo?: string;
}

export async function sendReminders(
  sites: Site[],
  timing: TimingMap,
  tpl: { subject: string; body: string },
  opts: { chase?: Chase; kind?: "reminder" | "follow" } = {},
): Promise<SendResult> {
  const live = isOutreachLive();
  const kind = opts.kind ?? "reminder";
  const suppressed = live ? await getSuppressedEmails() : new Set<string>();
  const skipped: SendResult["skipped"] = [];
  const ok = sites.filter((s) => {
    const reason = s.doNotSend
      ? "Marked do not send in SimPRO"
      : !EMAIL_RE.test(s.email)
        ? "No email on file"
        : suppressed.has(s.email.toLowerCase())
          ? "Unsubscribed or bounced"
          : null;
    if (reason) skipped.push({ key: s.key, name: s.name, reason });
    return !reason;
  });

  const resend = getResend();
  const fill = (s: Site) => {
    const vals = mergeVals(s, derive(s, timing[s.line]), ME);
    return { subject: merge(tpl.subject, vals), body: merge(tpl.body, vals) };
  };

  if (!live) {
    const first = ok[0];
    if (!first) return { live, sent: [], skipped };
    const m = fill(first);
    const more = ok.length > 1 ? ` (+${ok.length - 1} more in this batch)` : "";
    const { error } = await resend.emails.send({
      from: OUTREACH_FROM,
      to: OUTREACH_TEST_TO,
      replyTo: OUTREACH_REPLY_TO,
      subject: `[TEST for ${first.email}${more}] ${m.subject}`,
      text: m.body,
      html: buildOutreachEmail(m.body, OUTREACH_TEST_TO, first.email + more),
      headers: unsubscribeHeaders(OUTREACH_TEST_TO),
    });
    if (error) throw new Error(error.message);
    return { live, sent: [], skipped, sentTo: OUTREACH_TEST_TO };
  }

  const sent: string[] = [];
  const at = iso(today());
  for (const s of ok) {
    const m = fill(s);
    const { data, error } = await resend.emails.send({
      from: OUTREACH_FROM,
      to: s.email,
      replyTo: OUTREACH_REPLY_TO,
      subject: m.subject,
      text: m.body,
      html: buildOutreachEmail(m.body, s.email),
      headers: unsubscribeHeaders(s.email),
    });
    if (error || !data) {
      skipped.push({ key: s.key, name: s.name, reason: error?.message ?? "Send failed" });
      continue;
    }
    await recordMessage({ siteKey: s.key, kind, toEmail: s.email, subject: m.subject, body: m.body, resendEmailId: data.id });
    const prev = s.reminded;
    const state: SiteState =
      kind === "follow" && prev
        ? { ...stateOf(s), reminded: { ...prev, followups: prev.followups + 1 }, log: [...s.log, logLine("Follow-up sent", s.email, at)] }
        : {
            ...stateOf(s),
            chase: opts.chase ?? s.chase,
            snoozedUntil: null,
            flagged: undefined,
            reminded: { at, opened: 0, followups: 0, replied: false },
            // The earlier reminder moves into the log so the timeline keeps it.
            log: prev ? [...s.log, logLine("Reminder sent", s.email + (prev.opened ? ` · opened ${prev.opened}×` : " · not opened"), prev.at)] : s.log,
          };
    await saveSiteState(s.key, state);
    sent.push(s.key);
  }
  return { live, sent, skipped };
}

const logLine = (title: string, detail: string, date: string) => ({ kind: "email" as const, title, detail, date, t: Date.now() });
