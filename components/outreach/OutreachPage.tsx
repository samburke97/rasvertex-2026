"use client";
// components/outreach/OutreachPage.tsx
//
// Customer outreach queue (/outreach). The daily scan (lib/outreach/scan.ts)
// fills it from SimPRO; here a person reviews each email (filled from the
// rule's template, lib/outreach/templates.ts), edits it if needed, and sends it. Follow-ups come back into "Ready" on
// their own schedule until the customer quotes, replies or unsubscribes.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./OutreachPage.module.css";
import {
  OUTREACH_RULES,
  OUTREACH_RULE_LIST,
  maxTouches,
  type OutreachRuleId,
} from "@/lib/outreach/rules";
import type { Opportunity } from "@/lib/outreach/store";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import CountBadge from "@/components/ui/CountBadge";
import SearchInput from "@/components/ui/SearchInput";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import DataTable, { type Column } from "@/components/ui/DataTable";

type FilterKey = "ready" | "waiting" | "won" | "closed";

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function isReady(o: Opportunity, today: string): boolean {
  return (
    o.status === "open" &&
    !!o.nextTouchAt &&
    o.nextTouchAt <= today &&
    o.touchesSent < maxTouches(OUTREACH_RULES[o.ruleId])
  );
}

function bucket(o: Opportunity, today: string): FilterKey {
  if (o.status === "won") return "won";
  if (o.status === "closed" || o.status === "dismissed") return "closed";
  return isReady(o, today) ? "ready" : "waiting";
}

function reasonText(o: Opportunity): string {
  return o.sourceType === "job"
    ? `${o.sourceName} · completed ${formatDate(o.sourceDate)}`
    : `Q${o.sourceId} ${o.sourceName} · sent ${formatDate(o.sourceDate)}`;
}

// ── Review modal ──────────────────────────────────────────────────────────

function ReviewModal({
  opp,
  testTo,
  onClose,
  onChanged,
  onSent,
}: {
  opp: Opportunity;
  /** Set in test mode: where "Send" actually goes. */
  testTo: string | null;
  onClose: () => void;
  onChanged: (o: Opportunity) => void;
  onSent: (o: Opportunity, sentTo: string, test: boolean) => void;
}) {
  const rule = OUTREACH_RULES[opp.ruleId];
  const [subject, setSubject] = useState(opp.draftSubject ?? "");
  const [body, setBody] = useState(opp.draftBody ?? "");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touch = opp.touchesSent + 1;
  const ready = isReady(opp, todayISO());

  const draft = useCallback(async () => {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${opp.id}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Drafting failed");
      setSubject(data.opportunity.draftSubject ?? "");
      setBody(data.opportunity.draftBody ?? "");
      onChanged(data.opportunity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed");
    } finally {
      setDrafting(false);
    }
  }, [opp.id, onChanged]);

  // First open of a ready opportunity with no draft yet: write one.
  useEffect(() => {
    if (ready && !opp.draftBody) draft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveEdits = async () => {
    if (subject === (opp.draftSubject ?? "") && body === (opp.draftBody ?? "")) return;
    const res = await fetch(`/api/outreach/${opp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (res.ok) onChanged((await res.json()).opportunity);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${opp.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      onSent(data.opportunity, data.sentTo, data.test);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    saveEdits();
    onClose();
  };

  const rows: [string, React.ReactNode][] = [
    ["Rule", rule.label],
    ["Customer", opp.customer],
    ["Site", opp.site],
    [opp.sourceType === "job" ? "Last job" : "Quote", reasonText(opp)],
    [
      "To",
      opp.contactEmail ? (
        `${opp.contactName || "—"} <${opp.contactEmail}>`
      ) : (
        <span className={styles.warn}>No contact email in SimPRO</span>
      ),
    ],
    ["Email", `${touch} of ${maxTouches(rule)}${touch > 1 ? " (follow-up)" : ""}`],
  ];

  return (
    <Modal isOpen title="Review email" onClose={close}>
      <div className={styles.modalRows}>
        {rows.map(([label, value]) => (
          <div className={styles.modalRow} key={label}>
            <span className={styles.modalLabel}>{label}</span>
            <span className={styles.modalValue}>{value}</span>
          </div>
        ))}
      </div>

      {opp.messages.length > 0 && (
        <details className={styles.history}>
          <summary>Earlier emails ({opp.messages.length})</summary>
          {opp.messages.map((m) => (
            <div key={m.id} className={styles.historyItem}>
              <div className={styles.historyMeta}>
                {formatDate(m.sentAt)} · {m.subject}
                {m.bouncedAt ? " · bounced" : m.openedAt ? " · opened" : ""}
              </div>
              <div className={styles.historyBody}>{m.body}</div>
            </div>
          ))}
        </details>
      )}

      {drafting ? (
        <div className={styles.drafting}>
          <LoadingSpinner />
          <span>Filling in the template…</span>
        </div>
      ) : (
        <div className={styles.editor}>
          <label className={styles.fieldLabel} htmlFor="outreach-subject">
            Subject
          </label>
          <input
            id="outreach-subject"
            className={styles.input}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <label className={styles.fieldLabel} htmlFor="outreach-body">
            Message
          </label>
          <textarea
            id="outreach-body"
            className={styles.textarea}
            value={body}
            rows={14}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className={styles.hint}>
            An unsubscribe line is added below the message automatically.
            {testTo ? ` Test mode: this goes to ${testTo}, not the customer, and isn't counted as sent.` : ""}
          </p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.modalFooter}>
        <Button variant="secondary" onClick={draft} disabled={drafting || sending}>
          {opp.draftBody || body ? "Reset to template" : "Fill template"}
        </Button>
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={close} disabled={sending}>
            Close
          </Button>
          <Button
            variant="brand"
            onClick={send}
            disabled={!ready || drafting || sending || !subject.trim() || !body.trim() || !opp.contactEmail}
          >
            {sending ? "Sending…" : testTo ? `Send test to ${testTo}` : "Send email"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [rule, setRule] = useState<OutreachRuleId | "all">("all");
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ready");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<Opportunity | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [testTo, setTestTo] = useState<string | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/outreach");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOpps(data.opportunities ?? []);
      setTestTo(data.live ? null : (data.testTo ?? null));
    } catch {
      setError("Could not load outreach.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/outreach/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setToast(
        `Scan done: ${data.created} new, ${data.won} won, ${data.closed} closed`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const replace = useCallback((o: Opportunity) => {
    setOpps((prev) => prev.map((x) => (x.id === o.id ? o : x)));
  }, []);

  const setStatus = async (o: Opportunity, action: "dismiss" | "restore") => {
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/outreach/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: "Dismissed by staff" }),
      });
      if (!res.ok) throw new Error();
      replace((await res.json()).opportunity);
      setToast(action === "dismiss" ? `${o.site} dismissed` : `${o.site} restored`);
    } catch {
      alert(action === "dismiss" ? "Failed to dismiss" : "Failed to restore");
    } finally {
      setBusyId(null);
    }
  };

  const inRule = useMemo(
    () => (rule === "all" ? opps : opps.filter((o) => o.ruleId === rule)),
    [opps, rule],
  );

  const counts = useMemo(() => {
    const c = { ready: 0, waiting: 0, won: 0, closed: 0, wonTotal: 0, sent: 0, opened: 0 };
    for (const o of inRule) {
      const b = bucket(o, today);
      c[b]++;
      if (b === "won") c.wonTotal += o.outcomeTotal ?? 0;
      c.sent += o.messages.length;
      c.opened += o.messages.filter((m) => m.openedAt || m.clickedAt).length;
    }
    return c;
  }, [inRule, today]);

  const readyByRule = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opps) if (isReady(o, today)) m.set(o.ruleId, (m.get(o.ruleId) ?? 0) + 1);
    return m;
  }, [opps, today]);

  const filtered = useMemo(() => {
    const base = inRule.filter((o) => bucket(o, today) === filter);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (o) =>
        o.customer.toLowerCase().includes(q) ||
        o.site.toLowerCase().includes(q) ||
        o.contactEmail.toLowerCase().includes(q),
    );
  }, [inRule, filter, search, today]);

  const cards: { key: FilterKey; count: number; label: string; colorClass?: string; sub?: string }[] = [
    { key: "ready", count: counts.ready, label: "Ready to send", colorClass: styles.countReady },
    { key: "waiting", count: counts.waiting, label: "Waiting on follow-up" },
    {
      key: "won",
      count: counts.won,
      label: "Won",
      colorClass: styles.countWon,
      sub: counts.wonTotal ? `${formatCurrency(counts.wonTotal)} quoted` : undefined,
    },
    { key: "closed", count: counts.closed, label: "Closed / dismissed" },
  ];

  const columns: Column<Opportunity>[] = [
    {
      key: "site",
      header: "Customer",
      render: (o) => (
        <div className={styles.stack}>
          <span>{o.site}</span>
          <span className={styles.tdMuted}>{o.customer}</span>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Why",
      render: (o) => (
        <div className={styles.stack}>
          <span>{OUTREACH_RULES[o.ruleId].label}</span>
          <span className={styles.tdMuted}>{reasonText(o)}</span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (o) =>
        o.contactEmail ? (
          <div className={styles.stack}>
            <span>{o.contactName || "—"}</span>
            <span className={styles.tdMuted}>{o.contactEmail}</span>
          </div>
        ) : (
          <span className={styles.warn}>No email</span>
        ),
    },
    {
      key: "emails",
      header: "Emails",
      render: (o) => (
        <div className={styles.inline}>
          <span className={styles.tdMuted}>
            {o.touchesSent}/{maxTouches(OUTREACH_RULES[o.ruleId])}
          </span>
          {o.opened && <CountBadge variant="success" label="Opened" />}
        </div>
      ),
    },
    {
      key: "next",
      header: filter === "won" || filter === "closed" ? "Outcome" : "Next email",
      render: (o) => {
        if (o.status === "won")
          return (
            <span className={styles.tdWon}>
              {o.outcomeRef}
              {o.outcomeTotal ? ` · ${formatCurrency(o.outcomeTotal)}` : ""}
            </span>
          );
        if (o.status !== "open")
          return <span className={styles.tdMuted}>{o.outcomeRef ?? o.dismissedReason ?? "Closed"}</span>;
        if (!o.nextTouchAt) return <span className={styles.tdMuted}>All sent, watching for a quote</span>;
        return isReady(o, today) ? (
          <CountBadge variant={o.draftBody ? "success" : "warning"} label={o.draftBody ? "Draft ready" : "Due now"} />
        ) : (
          <span className={styles.tdMuted}>{formatDate(o.nextTouchAt)}</span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (o) => (
        <div className={styles.actions}>
          {o.status === "open" && (
            <Button
              variant={isReady(o, today) ? "brand" : "secondary"}
              size="sm"
              onClick={() => setReviewing(o)}
            >
              {isReady(o, today) ? "Review" : "View"}
            </Button>
          )}
          {o.status === "open" ? (
            <Button variant="ghost" size="sm" disabled={busyId === o.id} onClick={() => setStatus(o, "dismiss")}>
              Dismiss
            </Button>
          ) : o.status === "dismissed" ? (
            <Button variant="secondary" size="sm" disabled={busyId === o.id} onClick={() => setStatus(o, "restore")}>
              Restore
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const openRate = counts.sent ? Math.round((counts.opened / counts.sent) * 100) : null;

  return (
    <div className={styles.page}>
      <div className={styles.ruleTabs}>
        <button
          className={`${styles.ruleTab} ${rule === "all" ? styles.ruleTabActive : ""}`}
          onClick={() => setRule("all")}
        >
          All rules
        </button>
        {OUTREACH_RULE_LIST.map((r) => (
          <button
            key={r.id}
            className={`${styles.ruleTab} ${rule === r.id ? styles.ruleTabActive : ""}`}
            onClick={() => setRule(r.id)}
          >
            {r.label}
            {readyByRule.get(r.id) ? <span className={styles.tabCount}>{readyByRule.get(r.id)}</span> : null}
          </button>
        ))}
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Customer Outreach</h1>
          <p className={styles.subtitle}>
            {rule === "all"
              ? "Maintenance reminders and quote follow-ups from SimPRO history. Nothing sends until you review it."
              : OUTREACH_RULES[rule].trigger}
          </p>
        </div>
        <div className={styles.headerRight}>
          {openRate !== null && (
            <span className={styles.syncedAt}>
              {counts.sent} sent · {openRate}% opened
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={scan} disabled={scanning || loading}>
            {scanning ? "Scanning…" : "↺ Scan SimPRO"}
          </Button>
        </div>
      </div>

      {testTo && (
        <div className={styles.testBanner}>
          Test mode: emails go to {testTo} only, never to customers, and don&apos;t count against a
          customer&apos;s follow-ups.
        </div>
      )}

      <div className={styles.cards}>
        {cards.map(({ key, count, label, colorClass, sub }) => (
          <Card
            key={key}
            interactive
            onClick={() => setFilter(key)}
            padding="md"
            className={`${styles.card} ${filter === key ? styles.cardActive : ""}`}
          >
            <span className={`${styles.cardCount} ${colorClass ?? ""}`}>{count}</span>
            <span className={styles.cardLabel}>
              {label}
              {sub ? ` · ${sub}` : ""}
            </span>
          </Card>
        ))}
      </div>

      <div className={styles.searchRow}>
        <SearchInput
          placeholder="Search site, customer or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          className={styles.searchWrap}
        />
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          {error}
          <Button variant="secondary" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          emptyMessage={
            search
              ? `No results for "${search}"`
              : filter === "ready"
                ? "Nothing to send right now. Run a scan to check SimPRO."
                : "Nothing here."
          }
          itemsPerPage={25}
        />
      )}

      {reviewing && (
        <ReviewModal
          opp={reviewing}
          testTo={testTo}
          onClose={() => setReviewing(null)}
          onChanged={replace}
          onSent={(o, sentTo, test) => {
            replace(o);
            setReviewing(null);
            setToast(test ? `Test sent to ${sentTo}` : `Sent to ${sentTo}`);
          }}
        />
      )}
      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}
