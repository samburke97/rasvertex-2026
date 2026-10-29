// app/api/caro/run/route.ts
//
// The 6:00 run: works out what the reminder sequence and each switched-on
// automation would do to every site today. Nothing is sent or changed unless
// CARO_AUTOSEND=true; without it this is a dry run that returns the plan.
// With it, emails still follow test mode (OUTREACH_LIVE) like every other send.
// Not on a cron yet — add /api/caro/run to vercel.json when auto-send is wanted.

import { NextResponse } from "next/server";
import { getRan, getRules, getTemplates, getTiming, loadSites, saveSetting, saveSiteState } from "@/lib/caro/store";
import { sendReminders } from "@/lib/caro/send";
import { onTick, sequenceStep, type DSite } from "@/lib/caro/auto";
import { addDays, derive, iso, stateOf, today } from "@/lib/caro/data";

export const maxDuration = 300;

async function run() {
  const autosend = process.env.CARO_AUTOSEND === "true";
  try {
    const [{ sites }, timing, templates, rules, ran] = await Promise.all([loadSites(), getTiming(), getTemplates(), getRules(), getRan()]);
    const live: DSite[] = sites.filter((s) => !s.stopped).map((s) => ({ ...s, d: derive(s, timing[s.line]) }));
    const byKey = new Map(live.map((s) => [s.key, s]));

    const remind = live.filter((s) => sequenceStep(s, s.d, timing[s.line]) === "remind");
    const follow = live.filter((s) => sequenceStep(s, s.d, timing[s.line]) === "follow");
    const jobs = onTick(rules, live, autosend ? ran : new Set(ran));
    const plan = {
      remind: remind.map((s) => s.name),
      follow: follow.map((s) => s.name),
      rules: jobs.map((j) => ({ rule: j.ruleId, site: j.siteKey ? byKey.get(j.siteKey)?.name : "digest", actions: j.actions.map((a) => a.verb) })),
    };
    if (!autosend) return NextResponse.json({ dryRun: true, plan });

    const reminderTpl = templates.find((t) => t.system === "reminder");
    const followTpl = templates.find((t) => t.system === "follow");
    if (reminderTpl && remind.length) await sendReminders(remind, timing, reminderTpl, { kind: "reminder" });
    if (followTpl && follow.length) await sendReminders(follow, timing, followTpl, { kind: "follow" });

    const notConnected: string[] = [];
    for (const j of jobs) {
      const site = j.siteKey ? byKey.get(j.siteKey) : undefined;
      for (const a of j.actions) {
        if (a.verb === "send email" && site) {
          const tpl = templates.find((t) => t.name === a.template);
          if (tpl) await sendReminders([site], timing, tpl, { kind: "reminder" });
        } else if (a.verb === "move to" && site) {
          const st = stateOf(site);
          await saveSiteState(site.key, a.group === "Needs you" ? { ...st, flagged: true } : { ...st, snoozedUntil: iso(addDays(today(), 30)) });
        } else notConnected.push(a.verb);
      }
    }
    const counts = new Map<string, number>();
    jobs.forEach((j) => counts.set(j.ruleId, (counts.get(j.ruleId) ?? 0) + 1));
    await saveSetting("rules", rules.map((v) => (counts.has(v.id) ? { ...v, last: `Ran 6:00am · ${counts.get(v.id)} site${counts.get(v.id) === 1 ? "" : "s"}` } : v)));
    await saveSetting("ran", [...ran]);
    return NextResponse.json({ dryRun: false, plan, notConnected: [...new Set(notConnected)] });
  } catch (err) {
    console.error("[Caro] run failed:", err);
    return NextResponse.json({ error: "Run failed." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
