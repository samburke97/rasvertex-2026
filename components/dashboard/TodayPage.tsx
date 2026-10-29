"use client";
// components/dashboard/TodayPage.tsx
//
// Today (home): one sentence and one action, the four queues, then what
// needs you, most urgent first. Built from the app's real sources:
//   Revenue     — open outreach follow-ups (job/quote value at stake)
//   Operations  — recurring jobs overdue or due within 60 days
//   Customer    — top check-in clients with a lead angle and nothing blocking
//   Cash flow   — no invoice source yet, shown as not connected
// A source that fails to load just contributes nothing.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./TodayPage.module.css";
import { RECURRING_CATEGORY_LIST } from "@/lib/recertifications/categories";
import { LINE_OF_CATEGORY } from "@/lib/caro/data";
import { OUTREACH_RULES } from "@/lib/outreach/rules";
import type { RecertificationJob } from "@/lib/recertifications/types";
import type { Opportunity } from "@/lib/outreach/store";
import type { CheckinRow } from "@/lib/checkin/store";

type Queue = "revenue" | "operations" | "cash" | "customer";
type Urgency = "red" | "amber" | "slate" | "blue";

interface Item {
  id: string;
  queue: Queue;
  urgency: Urgency;
  title: string;
  detail: string;
  reason: string;
  value: number | null;
  action: string;
  href: string;
  rank: number;
}

const QUEUES: { id: Queue; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "operations", label: "Operations" },
  { id: "cash", label: "Cash flow" },
  { id: "customer", label: "Customer" },
];

const URGENCY_RANK: Record<Urgency, number> = { red: 0, amber: 1, slate: 2, blue: 3 };
const SHOWN = 5;

/** Money in summaries: $860, $28k, $1.2m. */
function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function loadItems(): Promise<Item[]> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [outreach, checkin, ...recurring] = await Promise.all([
    getJson<{ opportunities: Opportunity[] }>("/api/outreach"),
    getJson<{ rows: CheckinRow[] }>("/api/checkin"),
    ...RECURRING_CATEGORY_LIST.map((c) =>
      getJson<{ jobs: RecertificationJob[] }>(`/api/simpro/recertifications?category=${c.id}`),
    ),
  ]);
  const items: Item[] = [];

  // Revenue — follow-ups that are due, or drafted and waiting for a review.
  for (const o of outreach?.opportunities ?? []) {
    if (o.status !== "open") continue;
    const unsent = o.touchesSent === 0;
    const due = unsent ? o.dueDate <= todayISO : !!o.nextTouchAt && o.nextTouchAt.slice(0, 10) <= todayISO;
    if (!due) continue;
    const rule = OUTREACH_RULES[o.ruleId];
    items.push({
      id: `o-${o.id}`,
      queue: "revenue",
      urgency: unsent ? "amber" : "slate",
      title: o.customer,
      detail: [rule?.label ?? o.sourceName, o.site].filter(Boolean).join(" · "),
      reason: unsent
        ? "Draft ready. Have a read and send it."
        : o.opened
          ? `Opened your email, no reply after ${plural(o.touchesSent, "touch", "touches")}.`
          : `${plural(o.touchesSent, "email")} sent, no reply yet.`,
      value: o.sourceTotal || null,
      action: unsent ? "Review email" : "Follow up",
      href: "/outreach",
      rank: 0,
    });
  }

  // Operations — recurring work overdue or due within 60 days.
  RECURRING_CATEGORY_LIST.forEach((cat, i) => {
    for (const j of recurring[i]?.jobs ?? []) {
      if (j.status === "upcoming") continue;
      const overdue = j.status === "overdue";
      items.push({
        id: `r-${cat.id}-${j.id}`,
        queue: "operations",
        urgency: overdue ? "red" : "amber",
        title: j.customer,
        detail: [cat.label, j.site].filter(Boolean).join(" · "),
        reason: overdue
          ? `${cat.label} is overdue by ${plural(-j.daysUntilDue, "day")}.`
          : `${cat.label} is due in ${plural(j.daysUntilDue, "day")}.`,
        value: j.totalExTax || null,
        action: "Book it",
        href: `/caro#sites/${LINE_OF_CATEGORY[cat.id]}`,
        rank: j.daysUntilDue,
      });
    }
  });

  // Customer — the best check-ins, nothing blocking them.
  for (const c of (checkin?.rows ?? []).filter((r) => r.leadId && r.blockers.length === 0).slice(0, 8)) {
    items.push({
      id: `c-${c.id}`,
      queue: "customer",
      urgency: "blue",
      title: c.name,
      detail: [c.leadTitle, c.suburb].filter(Boolean).join(" · "),
      reason:
        c.monthsSince != null
          ? `Last job ${plural(c.monthsSince, "month")} ago. ${plural(c.jobCount, "job")}, ${money(c.ltv)} all up.`
          : `${plural(c.jobCount, "job")}, ${money(c.ltv)} all up.`,
      value: c.ltv || null,
      action: "Check in",
      href: "/caro#clients",
      rank: -c.score,
    });
  }

  return items.sort(
    (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.rank - b.rank || (b.value ?? 0) - (a.value ?? 0),
  );
}

export default function TodayPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadItems().then((r) => !cancelled && setItems(r));
    return () => {
      cancelled = true;
    };
  }, []);

  const byQueue = useMemo(() => {
    const m: Record<Queue, Item[]> = { revenue: [], operations: [], cash: [], customer: [] };
    for (const it of items ?? []) m[it.queue].push(it);
    return m;
  }, [items]);

  const urgent = (items ?? []).filter((i) => i.queue !== "customer");
  const atStake = urgent.reduce((s, i) => s + (i.value ?? 0), 0);
  const first = items?.[0];
  const list = queue ? byQueue[queue] : (items ?? []);
  const visible = showAll ? list : list.slice(0, SHOWN);
  const sum = (q: Queue) => byQueue[q].reduce((s, i) => s + (i.value ?? 0), 0);

  const sub: Record<Queue, string> = {
    revenue: byQueue.revenue.length ? `${money(sum("revenue"))} in follow-ups` : "Nothing to chase",
    operations: byQueue.operations.length
      ? `${byQueue.operations.filter((i) => i.urgency === "red").length} overdue · ${money(sum("operations"))}`
      : "All booked",
    cash: "Invoices not connected",
    customer: byQueue.customer.length ? "Worth a check-in" : "Nobody right now",
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Briefing: one sentence, one action */}
        <section className={styles.hero}>
          <span className={styles.heroDate}>{todayLabel()}</span>
          {items === null ? (
            <>
              <span className={`sk ${styles.skOnDark}`} style={{ width: "70%", height: 24 }} />
              <span className={`sk ${styles.skOnDark}`} style={{ width: "40%", height: 24 }} />
            </>
          ) : urgent.length ? (
            <h1 className={styles.heroTitle}>
              {plural(urgent.length, "thing")} need{urgent.length === 1 ? "s" : ""} you today
              {atStake > 0 && (
                <>
                  , and <em>{money(atStake)}</em> is riding on them
                </>
              )}
              .
            </h1>
          ) : (
            <h1 className={styles.heroTitle}>Nothing urgent today. A good day to check in with a client.</h1>
          )}
          {first && (
            <div className={styles.heroFoot}>
              <Link className={styles.btnOnDark} href={first.href}>
                Start with {first.title}
              </Link>
              <span className={styles.heroNote}>{first.reason}</span>
            </div>
          )}
        </section>

        {/* Where it's sitting: four queues; clicking one filters the list */}
        <section className={styles.section}>
          <h2 className="t-group">Where it&apos;s sitting</h2>
          <div className={styles.queueStrip}>
            {QUEUES.map((q) => (
              <button
                key={q.id}
                type="button"
                className={styles.queueCell}
                aria-pressed={queue === q.id}
                disabled={q.id === "cash"}
                onClick={() => {
                  setQueue(queue === q.id ? null : q.id);
                  setShowAll(false);
                }}
              >
                <span className="t-label">{q.label}</span>
                {items === null ? (
                  <span className={styles.queueValue}>
                    <span className="sk sk--title" style={{ width: 22, height: 18 }} />
                    <span className="sk sk--line" style={{ width: 90 }} />
                  </span>
                ) : (
                  <span className={styles.queueValue}>
                    <span className={styles.queueCount}>{q.id === "cash" ? "—" : byQueue[q.id].length}</span>
                    <span className="t-meta">{sub[q.id]}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Priority list: dot · what + why · value · one action */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className="t-group">What needs you</h2>
            {queue && (
              <button type="button" className={styles.btnNeutralSm} onClick={() => setQueue(null)}>
                Show everything
              </button>
            )}
          </div>
          <div className={styles.priorityList}>
            {items === null &&
              ["58%", "44%", "66%", "50%", "38%"].map((w, i) => (
                <div key={i} className={styles.priority}>
                  <span className="sk" style={{ width: 6, height: 6, borderRadius: 2 }} />
                  <div className={styles.priorityText}>
                    <span className="sk sk--title" style={{ width: w }} />
                    <span className="sk sk--line" style={{ width: "36%" }} />
                  </div>
                  <span className="sk sk--title" style={{ width: 56, justifySelf: "end" }} />
                  <span className="sk" style={{ height: 32, borderRadius: 8 }} />
                </div>
              ))}

            {items !== null && list.length === 0 && (
              <div className={styles.empty}>
                <span className={styles.emptyTitle}>Nothing needs you here.</span>
                <span className="t-meta">Try another queue, or enjoy the quiet.</span>
              </div>
            )}

            {visible.map((it) => (
              <div key={it.id} className={styles.priorityWrap}>
                <div
                  className={styles.priority}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded === it.id}
                  onClick={() => setExpanded(expanded === it.id ? null : it.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(expanded === it.id ? null : it.id);
                    }
                  }}
                >
                  <span className={styles.dot} data-urgency={it.urgency} />
                  <div className={styles.priorityText}>
                    <span className={styles.priorityTitle}>{it.title}</span>
                    <span className={`t-meta ${styles.truncate}`}>{it.detail}</span>
                  </div>
                  <span className={styles.priorityValue} title={it.queue === "customer" ? "All jobs to date" : undefined}>
                    {it.value ? money(it.value) : ""}
                  </span>
                  <Link className={styles.btnNeutralSm} href={it.href} onClick={(e) => e.stopPropagation()}>
                    {it.action}
                  </Link>
                </div>
                {expanded === it.id && <div className={styles.reason}>{it.reason}</div>}
              </div>
            ))}

            {!showAll && list.length > SHOWN && (
              <button type="button" className={styles.more} onClick={() => setShowAll(true)}>
                Show {list.length - SHOWN} more
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
