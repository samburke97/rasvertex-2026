"use client";
// components/recertifications/RecertificationPage.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Image from "next/image";
import styles from "./RecertificationPage.module.css";
import type { RecertificationJob } from "@/app/api/simpro/recertifications/route";

function formatDate(iso: string): string {
  if (!iso) return "—";
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

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

// ── Parse deep link params synchronously ─────────────────────────────────
// Called once at module level so the result is available before any render.
function parseDeepLinkParams(): RecertificationJob | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (params.get("action") !== "quote") return null;

  const jobId = Number(params.get("jobId"));
  const customerId = Number(params.get("customerId"));
  const siteId = Number(params.get("siteId"));
  const site = params.get("site") || "";
  const customer = params.get("customer") || "";
  const nextDueDate = params.get("nextDueDate") || "";
  const lastExTax = Number(params.get("lastExTax") || 0);

  if (!jobId || !customerId || !siteId) return null;

  const currentYear = new Date().getFullYear();
  const dueYear = nextDueDate
    ? new Date(nextDueDate).getFullYear()
    : currentYear;
  const quoteYear = Math.max(dueYear, currentYear);

  // Strip params from URL immediately so a refresh doesn't re-open the modal
  window.history.replaceState({}, "", window.location.pathname);

  return {
    id: jobId,
    name: "",
    customer,
    customerId,
    site,
    siteId,
    completedDate: "",
    nextDueDate,
    daysUntilDue: 0,
    status: "overdue",
    totalExTax: lastExTax,
    totalIncTax: Math.round(lastExTax * 1.1 * 100) / 100,
    quoteYear,
  };
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
      highlight: true,
    },
    { label: "Customer", value: job.customer },
    { label: "Site", value: job.site },
    {
      label: "Last price (ex GST)",
      value: `$${job.totalExTax.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
    },
    {
      label: "New price (ex GST) +5%",
      value: `$${newExTax.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
      highlight: true,
    },
    {
      label: "New price (inc GST)",
      value: `$${newIncTax.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
    },
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
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create quote in SimPRO</h2>
          <button className={styles.modalClose} onClick={onCancel}>
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          {rows.map(({ label, value, highlight }) => (
            <React.Fragment key={label}>
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
type FilterKey = "all" | "overdue" | "due-soon" | "upcoming" | "hidden";

export default function RecertificationPage() {
  const [jobs, setJobs] = useState<RecertificationJob[]>([]);
  const [ignoredJobs, setIgnoredJobs] = useState<RecertificationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ignoringId, setIgnoringId] = useState<number | null>(null);

  // Parse deep link params synchronously on first render so the modal opens
  // immediately — before load() completes. useRef ensures we only parse once.
  const deepLinkJob = useRef<RecertificationJob | null>(
    typeof window !== "undefined" ? parseDeepLinkParams() : null,
  );
  const [confirmJob, setConfirmJob] = useState<RecertificationJob | null>(
    deepLinkJob.current,
  );

  // ── Load from SimPRO ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simpro/recertifications");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setIgnoredJobs(data.ignoredJobs ?? []);
      setSyncedAt(data.syncedAt ? new Date(data.syncedAt) : null);
    } catch {
      setError("Could not load recertification data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sync from SimPRO — triggered manually or by cron ─────────────────
  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/simpro/recertifications/sync", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setIgnoredJobs(data.ignoredJobs ?? []);
      setSyncedAt(data.syncedAt ? new Date(data.syncedAt) : null);
      setToast("Synced with SimPRO");
    } catch {
      setError("Sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Quote action ──────────────────────────────────────────────────────
  const handleQuoteAction = (job: RecertificationJob) => {
    setConfirmJob(job);
  };

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

      // Move the job to upcoming locally — shift nextDueDate forward one year
      setJobs((prev) =>
        prev.map((j) => {
          if (j.id !== confirmJob.id) return j;
          const currentNextDue = new Date(j.nextDueDate);
          const effectiveNextDue = new Date(currentNextDue);
          effectiveNextDue.setFullYear(currentNextDue.getFullYear() + 1);
          const daysUntilDue = Math.ceil(
            (effectiveNextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          return {
            ...j,
            nextDueDate: effectiveNextDue.toISOString().split("T")[0],
            daysUntilDue,
            status: "upcoming" as const,
          };
        }),
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

  // ── Derived counts ────────────────────────────────────────────────────
  const overdueCt = useMemo(
    () => jobs.filter((j) => j.status === "overdue").length,
    [jobs],
  );
  const dueSoonCt = useMemo(
    () => jobs.filter((j) => j.status === "due-soon").length,
    [jobs],
  );
  const upcomingCt = useMemo(
    () => jobs.filter((j) => j.status === "upcoming").length,
    [jobs],
  );

  const filtered = useMemo(() => {
    const base: RecertificationJob[] =
      filter === "hidden"
        ? ignoredJobs
        : filter === "all"
          ? jobs
          : jobs.filter((j) => j.status === filter);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (j) =>
        j.customer.toLowerCase().includes(q) ||
        j.site.toLowerCase().includes(q),
    );
  }, [filter, search, jobs, ignoredJobs]);

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
    { key: "hidden", count: ignoredJobs.length, label: "Hidden" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Anchor Recertifications</h1>
        <div className={styles.headerRight}>
          {syncedAt && (
            <span className={styles.syncedAt}>Synced {timeAgo(syncedAt)}</span>
          )}
          <button
            className={styles.refreshBtn}
            onClick={sync}
            disabled={syncing || loading}
          >
            {syncing ? "Syncing…" : "↺ Sync"}
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

      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/utility-outline/search.svg"
            width={14}
            height={14}
            alt=""
            className={styles.searchIcon}
          />
          <input
            className={styles.searchInput}
            placeholder="Search customer or site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className={styles.searchClearBtn}
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/utility-outline/cross.svg"
                width={12}
                height={12}
                alt="Clear"
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
          <button className={styles.retryBtn} onClick={load}>
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
                  <th className={styles.th}>Last Completed</th>
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
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          {!isHidden && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleQuoteAction(job)}
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
                          )}
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
                              {isIgnoring ? (
                                "…"
                              ) : (
                                <Image
                                  src="/icons/utility-outline/trash.svg"
                                  width={15}
                                  height={15}
                                  alt="Hide"
                                  className={styles.actionIcon}
                                  priority
                                />
                              )}
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
