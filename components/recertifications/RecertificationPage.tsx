"use client";
// components/recertifications/RecertificationPage.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import styles from "./RecertificationPage.module.css";
import type { RecertificationJob } from "@/app/api/simpro/recertifications/route";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(n);
}

function StatusPill({
  status,
  days,
}: {
  status: RecertificationJob["status"];
  days: number;
}) {
  if (status === "overdue")
    return (
      <span className={styles.pillOverdue}>Overdue {Math.abs(days)}d</span>
    );
  if (status === "due-soon")
    return <span className={styles.pillDueSoon}>Due in {days}d</span>;
  return <span className={styles.pillUpcoming}>{days}d away</span>;
}

function QuoteStatusBadge({
  quote,
}: {
  quote: RecertificationJob["existingQuote"];
}) {
  if (!quote) return null;
  const isSent =
    quote.quoteStatus === "sent" || quote.quoteStatus === "approved";
  return (
    <span className={isSent ? styles.quoteBadgeSent : styles.quoteBadgeCreated}>
      {isSent ? "Sent" : "Created"}
      {quote.simproQuoteNo && (
        <span className={styles.quoteBadgeNo}> #{quote.simproQuoteNo}</span>
      )}
    </span>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────
function ConfirmModal({
  job,
  onConfirm,
  onCancel,
  creating,
}: {
  job: RecertificationJob;
  onConfirm: () => void;
  onCancel: () => void;
  creating: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const dueYear = new Date(job.nextDueDate).getFullYear();
  const quoteYear = Math.max(dueYear, currentYear);
  const newExTax = Math.round(job.totalExTax * 1.05 * 100) / 100;
  const newIncTax = Math.round(newExTax * 1.1 * 100) / 100;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const rows: { label: string; value: string; highlight?: boolean }[] = [
    {
      label: "Quote name",
      value: `Annual Anchor Recertification - ${quoteYear}`,
    },
    { label: "Customer", value: job.customer },
    { label: "Site", value: job.site },
    { label: "Last price (ex)", value: formatCurrency(job.totalExTax) },
    {
      label: "New price +5% (ex)",
      value: formatCurrency(newExTax),
      highlight: true,
    },
    { label: "Inc GST", value: formatCurrency(newIncTax) },
    {
      label: "Due date",
      value: dueDate.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    },
  ];

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Create Quote</span>
          <button className={styles.modalClose} onClick={onCancel}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/utility-outline/close.svg"
              width={14}
              height={14}
              alt="Close"
              style={{ opacity: 0.4, display: "block" }}
            />
          </button>
        </div>
        <div className={styles.modalBody}>
          {rows.map(({ label, value, highlight }, i) => (
            <React.Fragment key={label}>
              {i === 3 && <div className={styles.modalDivider} />}
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>{label}</span>
                <span
                  className={`${styles.modalValue} ${highlight ? styles.modalValueGreen : ""}`}
                >
                  {value}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className={styles.modalFooter}>
          <button
            className={styles.modalCancelBtn}
            onClick={onCancel}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            className={styles.modalConfirmBtn}
            onClick={onConfirm}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create in SimPRO"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={styles.toast}>
      {message}
      <button className={styles.toastClose} onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/utility-outline/close.svg"
          width={14}
          height={14}
          alt="Close"
          style={{ opacity: 0.5, display: "block" }}
        />
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
type FilterKey =
  | "all"
  | "overdue"
  | "due-soon"
  | "upcoming"
  | "quoted"
  | "hidden";

export default function RecertificationPage() {
  const [jobs, setJobs] = useState<RecertificationJob[]>([]);
  const [ignoredJobs, setIgnoredJobs] = useState<RecertificationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [confirmJob, setConfirmJob] = useState<RecertificationJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ignoringId, setIgnoringId] = useState<number | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        refresh
          ? "/api/simpro/recertifications?refresh=true"
          : "/api/simpro/recertifications",
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setIgnoredJobs(data.ignoredJobs ?? []);
      setFromCache(data.fromCache ?? false);
      setCacheAge(data.cacheAge ?? null);
      if (refresh && data.jobs?.length) {
        const siteIds = [
          ...new Set((data.jobs as RecertificationJob[]).map((j) => j.siteId)),
        ];
        fetch("/api/simpro/recertifications/sync-quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteIds }),
        })
          .then((r) => r.json())
          .then((s) => {
            if (s.synced > 0) {
              fetch("/api/simpro/recertifications")
                .then((r) => r.json())
                .then((d) => {
                  setJobs(d.jobs ?? []);
                  setIgnoredJobs(d.ignoredJobs ?? []);
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }
    } catch {
      setError("Could not load recertification data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const handleCreateQuote = async () => {
    if (!confirmJob) return;
    setCreating(true);
    try {
      const res = await fetch("/api/simpro/recertifications/create-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: confirmJob.customerId,
          siteId: confirmJob.siteId,
          siteName: confirmJob.site,
          customer: confirmJob.customer,
          lastExTax: confirmJob.totalExTax,
          nextDueDate: confirmJob.nextDueDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const result = await res.json();
      setJobs((prev) =>
        prev.map((j) =>
          j.id === confirmJob.id
            ? {
                ...j,
                existingQuote: {
                  quoteId: result.quoteId,
                  quoteName: result.quoteName,
                  quoteStatus: "created",
                  simproQuoteNo: result.quoteNo || null,
                },
              }
            : j,
        ),
      );
      setToast(`Quote created — ${result.quoteName}`);
      setConfirmJob(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setCreating(false);
    }
  };

  const handleIgnore = async (job: RecertificationJob) => {
    setIgnoringId(job.id);
    try {
      await fetch("/api/simpro/recertifications/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      setIgnoredJobs((prev) => [...prev, job]);
      setToast(`${job.site} hidden`);
    } catch {
      alert("Failed to hide");
    } finally {
      setIgnoringId(null);
    }
  };

  const handleRestore = async (job: RecertificationJob) => {
    setIgnoringId(job.id);
    try {
      await fetch("/api/simpro/recertifications/ignore", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      setIgnoredJobs((prev) => prev.filter((j) => j.id !== job.id));
      setJobs((prev) =>
        [...prev, job].sort((a, b) => a.daysUntilDue - b.daysUntilDue),
      );
      setToast(`${job.site} restored`);
    } catch {
      alert("Failed to restore");
    } finally {
      setIgnoringId(null);
    }
  };

  const unquoted = useMemo(() => jobs.filter((j) => !j.existingQuote), [jobs]);
  const quoted = useMemo(() => jobs.filter((j) => !!j.existingQuote), [jobs]);
  const overdueCt = useMemo(
    () => unquoted.filter((j) => j.status === "overdue").length,
    [unquoted],
  );
  const dueSoonCt = useMemo(
    () => unquoted.filter((j) => j.status === "due-soon").length,
    [unquoted],
  );
  const upcomingCt = useMemo(
    () => unquoted.filter((j) => j.status === "upcoming").length,
    [unquoted],
  );

  const filtered = useMemo(() => {
    let base: RecertificationJob[] =
      filter === "hidden"
        ? ignoredJobs
        : filter === "quoted"
          ? quoted
          : filter === "all"
            ? unquoted
            : unquoted.filter((j) => j.status === filter);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.customer.toLowerCase().includes(q) ||
        j.site.toLowerCase().includes(q),
    );
  }, [filter, search, unquoted, quoted, ignoredJobs]);

  const cards: {
    key: FilterKey;
    count: number;
    label: string;
    colorClass?: string;
  }[] = [
    { key: "all", count: jobs.length, label: "Total" },
    {
      key: "overdue",
      count: overdueCt,
      label: "Overdue",
      colorClass: styles.countOverdue,
    },
    {
      key: "due-soon",
      count: dueSoonCt,
      label: "Due within 60 days",
      colorClass: styles.countDueSoon,
    },
    {
      key: "upcoming",
      count: upcomingCt,
      label: "Upcoming",
      colorClass: styles.countUpcoming,
    },
    {
      key: "quoted",
      count: quoted.length,
      label: "Quoted",
      colorClass: styles.countQuoted,
    },
    { key: "hidden", count: ignoredJobs.length, label: "Hidden" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Anchor Recertifications</h1>
        <div className={styles.headerRight}>
          {fromCache && cacheAge && (
            <span className={styles.cacheNote}>Cached {cacheAge}</span>
          )}
          <button
            className={styles.refreshBtn}
            onClick={() => load(true)}
            disabled={loading}
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      <div className={styles.cards}>
        {cards.map(({ key, count, label, colorClass }) => (
          <button
            key={key}
            className={`${styles.card} ${filter === key ? styles.cardActive : ""}`}
            onClick={() => setFilter(key)}
          >
            <span className={`${styles.cardCount} ${colorClass ?? ""}`}>
              {count}
            </span>
            <span className={styles.cardLabel}>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.searchSection}>
        <label className={styles.searchLabel}>Search</label>
        <div className={styles.searchWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/utility-outline/search.svg"
            width={15}
            height={15}
            alt=""
            style={{
              position: "absolute",
              left: 11,
              opacity: 0.35,
              pointerEvents: "none",
            }}
          />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search customer or site…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className={styles.searchClear}
              onClick={() => setSearch("")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/utility-outline/close.svg"
                width={14}
                height={14}
                alt="Clear"
                style={{ display: "block", opacity: 0.4 }}
              />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          {error}
          <button className={styles.retryBtn} onClick={() => load(false)}>
            Retry
          </button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              {search ? `No results for "${search}"` : "Nothing here."}
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Customer</th>
                  <th className={styles.th}>Site</th>
                  <th className={styles.th}>Completed</th>
                  <th className={styles.th}>Next Due</th>
                  <th className={styles.th}>Last Price</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const isHidden = filter === "hidden";
                  const isIgnoring = ignoringId === job.id;
                  return (
                    <tr
                      key={job.id}
                      className={`${styles.tr} ${isHidden ? styles.trHidden : ""}`}
                    >
                      <td className={styles.td}>{job.customer}</td>
                      <td className={styles.td}>{job.site}</td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>
                        {formatDate(job.completedDate)}
                      </td>
                      {/* Next Due — same font size as every other cell, just red when overdue */}
                      <td
                        className={`${styles.td} ${styles.tdMuted} ${job.status === "overdue" && !isHidden ? styles.tdOverdue : ""}`}
                      >
                        {formatDate(job.nextDueDate)}
                      </td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>
                        {formatCurrency(job.totalExTax)} ex
                      </td>
                      <td className={styles.td}>
                        <StatusPill
                          status={job.status}
                          days={job.daysUntilDue}
                        />
                      </td>
                      {/* Actions: quote badge OR edit icon, then trash/restore — all left-aligned */}
                      <td className={styles.td}>
                        <div className={styles.actionGroup}>
                          {!isHidden &&
                            (job.existingQuote ? (
                              <QuoteStatusBadge quote={job.existingQuote} />
                            ) : (
                              <button
                                className={styles.actionBtn}
                                onClick={() => setConfirmJob(job)}
                                title="Create quote"
                              >
                                <Image
                                  src="/icons/utility-outline/edit.svg"
                                  width={15}
                                  height={15}
                                  alt="Create quote"
                                  className={styles.actionIcon}
                                  priority
                                />
                              </button>
                            ))}
                          {isHidden ? (
                            <button
                              className={styles.restoreBtn}
                              onClick={() => handleRestore(job)}
                              disabled={isIgnoring}
                            >
                              {isIgnoring ? "…" : "Restore"}
                            </button>
                          ) : (
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleIgnore(job)}
                              disabled={isIgnoring}
                              title="Hide"
                            >
                              <Image
                                src="/icons/utility-outline/trash.svg"
                                width={15}
                                height={15}
                                alt="Hide"
                                className={styles.actionIcon}
                                priority
                              />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {confirmJob && (
        <ConfirmModal
          job={confirmJob}
          onConfirm={handleCreateQuote}
          onCancel={() => setConfirmJob(null)}
          creating={creating}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
