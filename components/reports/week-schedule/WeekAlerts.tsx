"use client";
// components/reports/week-schedule/WeekAlerts.tsx
//
// The Weekly schedule's Alerts, in its left panel: each job cost centre on
// the schedule checked against its estimate (lib/reports/jobAlerts.ts),
// worst first. Read from SimPRO after the schedule; only in the builder,
// never on the PDF.

import { useEffect, useState } from "react";
import panel from "../shared/OptionsPanel.module.css";
import styles from "./WeekSchedulePage.module.css";
import InfoTip from "@/components/reports/shared/builder/InfoTip";
import { ALERT_LABEL, type JobAlert } from "@/lib/reports/jobAlerts";
import type { WeekEntry } from "@/lib/reports/weekSchedule";

type State = { phase: "idle" } | { phase: "loading" } | { phase: "done"; alerts: JobAlert[]; checked: number } | { phase: "error" };

const h = (n: number) => `${Math.round(n * 10) / 10}h`;

export default function WeekAlerts({ entries, reloadKey }: { entries: WeekEntry[] | null; reloadKey: number }) {
  const refs = [...new Set((entries ?? []).filter((e) => e.kind === "job" && e.ref && e.cc).map((e) => `${e.ref}-${e.cc}`))].sort().join(",");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!refs) {
      setState({ phase: "idle" });
      return;
    }
    let live = true;
    setState({ phase: "loading" });
    fetch(`/api/simpro/schedules/alerts?refs=${refs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { alerts: JobAlert[]; checked: number }) => live && setState({ phase: "done", ...d }))
      .catch(() => live && setState({ phase: "error" }));
    return () => {
      live = false;
    };
  }, [refs, reloadKey]);

  const count = state.phase === "done" ? state.alerts.filter((a) => a.level !== "noEstimate").length : 0;

  return (
    <div className={panel.group}>
      <div className={panel.groupLabelRow}>
        <span className={panel.groupLabel}>
          Alerts{" "}
          <InfoTip>
            Each job on the schedule, checked in SimPRO: hours used (everything booked up to today) plus hours still booked, against
            the estimate; and the resources cost against its estimate. Only here, never on the PDF.
          </InfoTip>
        </span>
        {count > 0 && <span className={styles.alertCount}>{count}</span>}
      </div>
      {state.phase === "loading" && <p className={panel.subLabel}>Checking the jobs against their estimates…</p>}
      {state.phase === "error" && <p className={panel.subLabel}>Couldn&apos;t check the jobs in SimPRO. Refresh to try again.</p>}
      {state.phase === "idle" && <p className={panel.subLabel}>No jobs on the schedule to check.</p>}
      {state.phase === "done" && !state.alerts.length && (
        <p className={panel.subLabel}>
          All {state.checked} job{state.checked === 1 ? "" : "s"} on track: used and booked hours are within estimate.
        </p>
      )}
      {state.phase === "done" &&
        state.alerts.map((a) => {
          const pct = a.estHours > 0 ? Math.min(100, (a.actualHours / Math.max(a.estHours, a.finishHours)) * 100) : 0;
          const bookedPct = a.estHours > 0 ? Math.min(100 - pct, (a.futureHours / Math.max(a.estHours, a.finishHours)) * 100) : 0;
          const estAt = a.estHours > 0 ? (a.estHours / Math.max(a.estHours, a.finishHours)) * 100 : 0;
          return (
            <div key={a.key} className={`${styles.alert} ${styles[`alert_${a.level}`]}`}>
              <button className={styles.alertHead} onClick={() => setOpen(open === a.key ? null : a.key)} aria-expanded={open === a.key}>
                <span className={styles.alertDot} />
                <span className={styles.alertTitle}>
                  <b>{a.site}</b>
                  <small>
                    #{a.jobId}
                    {a.name && ` · ${a.name}`}
                  </small>
                </span>
                <span className={styles.alertTag}>{ALERT_LABEL[a.level]}</span>
              </button>
              {a.estHours > 0 && (
                <div className={styles.alertBar} title={`${h(a.actualHours)} used, ${h(a.futureHours)} booked, ${h(a.estHours)} estimated`}>
                  <span className={styles.alertUsed} style={{ width: `${pct}%` }} />
                  <span className={styles.alertBooked} style={{ width: `${bookedPct}%` }} />
                  <span className={styles.alertEst} style={{ left: `${estAt}%` }} />
                </div>
              )}
              {a.lines.map((l, i) => (
                <p key={i} className={styles.alertLine}>
                  {l}
                </p>
              ))}
              {open === a.key && a.team.length > 0 && (
                <div className={styles.alertTeam}>
                  <span>Hours by team member, used and booked</span>
                  {a.team.map((t) => (
                    <div key={t.name}>
                      <span>{t.name}</span>
                      <span>{h(t.hours)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
