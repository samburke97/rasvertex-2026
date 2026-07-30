"use client";
// components/recurring-jobs/RecurringJobsPage.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import styles from "./RecurringJobsPage.module.css";
import type { RecertificationJob } from "@/lib/recertifications/types";
import {
  RECURRING_CATEGORIES,
  RECURRING_CATEGORY_LIST,
  isRecurringCategory,
  type RecurringCategory,
} from "@/lib/recertifications/categories";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import CountBadge from "@/components/ui/CountBadge";
import SearchInput from "@/components/ui/SearchInput";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import DataTable, { type Column } from "@/components/ui/DataTable";

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
      <CountBadge variant="danger" label={`Overdue ${Math.abs(days)}d`} />
    );
  if (status === "due-soon")
    return <CountBadge variant="warning" label={`Due in ${days}d`} />;
  return <CountBadge variant="neutral" label={`${days}d away`} />;
}

// ── Parse deep link params synchronously ─────────────────────────────────
// Called once at module level so the result is available before any render.
function parseDeepLinkParams(): {
  category: RecurringCategory;
  job: RecertificationJob;
} | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (params.get("action") !== "quote") return null;

  const category = params.get("category");
  if (!isRecurringCategory(category)) return null;

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
    category,
    job: {
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
    },
  };
}

// ── Confirm quote modal ────────────────────────────────────────────────────
function ConfirmQuoteModal({
  job,
  category,
  onConfirm,
  onCancel,
  creating,
}: {
  job: RecertificationJob;
  category: RecurringCategory;
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
      value: RECURRING_CATEGORIES[category].quoteName(quoteYear),
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
    <Modal isOpen title="Create quote in SimPRO" onClose={onCancel}>
      <div className={styles.modalRows}>
        {rows.map(({ label, value, highlight }) => (
          <div className={styles.modalRow} key={label}>
            <span className={styles.modalLabel}>{label}</span>
            <span
              className={`${styles.modalValue} ${highlight ? styles.modalValueHighlight : ""}`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.modalFooter}>
        <Button variant="secondary" onClick={onCancel} disabled={creating}>
          Cancel
        </Button>
        <Button variant="brand" onClick={onConfirm} disabled={creating}>
          {creating ? "Creating…" : "Create in SimPRO"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
type FilterKey = "all" | "overdue" | "due-soon" | "upcoming" | "hidden";

export default function RecurringJobsPage() {
  // Parse deep link params synchronously on first render so the right
  // category + modal are already selected before load() completes.
  const deepLink = useRef(
    typeof window !== "undefined" ? parseDeepLinkParams() : null,
  );

  const [category, setCategory] = useState<RecurringCategory>(
    deepLink.current?.category ?? "height-safety",
  );
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

  const [confirmJob, setConfirmJob] = useState<RecertificationJob | null>(
    deepLink.current?.job ?? null,
  );

  const config = RECURRING_CATEGORIES[category];

  // ── Load from SimPRO ──────────────────────────────────────────────────
  const load = useCallback(async (cat: RecurringCategory) => {
    setLoading(true);
    setError(null);
    // Clear the previous category's data immediately — otherwise the
    // summary cards keep showing the old category's counts (stale, and
    // easy to misread as belonging to the newly-selected category) for
    // however long the live SimPRO fetch takes.
    setJobs([]);
    setIgnoredJobs([]);
    setSyncedAt(null);
    try {
      const res = await fetch(
        `/api/simpro/recertifications?category=${cat}`,
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setIgnoredJobs(data.ignoredJobs ?? []);
      setSyncedAt(data.syncedAt ? new Date(data.syncedAt) : null);
    } catch {
      setError("Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sync from SimPRO — triggered manually ─────────────────────────────
  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/simpro/recertifications/sync?category=${category}`,
        { method: "POST" },
      );
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
  }, [category]);

  useEffect(() => {
    load(category);
    setFilter("all");
    setSearch("");
  }, [category, load]);

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
          category,
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
      const res = await fetch("/api/simpro/recertifications/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, category }),
      });
      if (!res.ok) throw new Error("Failed to hide");
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
      const res = await fetch("/api/simpro/recertifications/ignore", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, category }),
      });
      if (!res.ok) throw new Error("Failed to restore");
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

  const isHiddenView = filter === "hidden";

  const columns: Column<RecertificationJob>[] = [
    { key: "customer", header: "Customer" },
    { key: "site", header: "Site" },
    {
      key: "completedDate",
      header: "Last Completed",
      render: (job) => (
        <span className={styles.tdMuted}>{formatDate(job.completedDate)}</span>
      ),
    },
    {
      key: "nextDueDate",
      header: "Next Due",
      render: (job) => (
        <span
          className={`${styles.tdMuted} ${job.status === "overdue" && !isHiddenView ? styles.tdOverdue : ""}`}
        >
          {formatDate(job.nextDueDate)}
        </span>
      ),
    },
    {
      key: "totalExTax",
      header: "Last Price",
      render: (job) => (
        <span className={styles.tdMuted}>
          {formatCurrency(job.totalExTax)} ex
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (job) => <StatusPill status={job.status} days={job.daysUntilDue} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (job) => {
        const isIgnoring = ignoringId === job.id;
        return (
          <div className={styles.actions}>
            {!isHiddenView && (
              <IconButton
                variant="secondary"
                size="sm"
                title="Create quote"
                onClick={() => handleQuoteAction(job)}
                icon={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/icons/utility-outline/edit.svg" width={15} height={15} alt="" />
                }
              />
            )}
            {isHiddenView ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleRestore(job)}
                disabled={isIgnoring}
              >
                {isIgnoring ? "…" : "Restore"}
              </Button>
            ) : (
              <IconButton
                variant="secondary"
                size="sm"
                title="Hide"
                onClick={() => handleIgnore(job)}
                disabled={isIgnoring}
                icon={
                  isIgnoring ? (
                    "…"
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/icons/utility-outline/trash.svg" width={15} height={15} alt="" />
                  )
                }
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.page}>
      {/* ── Category selector ── */}
      <div className={styles.categoryTabs}>
        {RECURRING_CATEGORY_LIST.map((c) => (
          <button
            key={c.id}
            className={`${styles.categoryTab} ${
              category === c.id ? styles.categoryTabActive : ""
            }`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>{config.pageHeading}</h1>
        <div className={styles.headerRight}>
          {syncedAt && (
            <span className={styles.syncedAt}>Synced {timeAgo(syncedAt)}</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={sync}
            disabled={syncing || loading}
          >
            {syncing ? "Syncing…" : "↺ Sync"}
          </Button>
        </div>
      </div>

      <div className={styles.cards}>
        {cards.map(({ key, count, label, colorClass }) => (
          <Card
            key={key}
            interactive
            onClick={() => setFilter(key)}
            padding="md"
            className={`${styles.card} ${filter === key ? styles.cardActive : ""}`}
          >
            <span className={`${styles.cardCount} ${colorClass ?? ""}`}>
              {count}
            </span>
            <span className={styles.cardLabel}>{label}</span>
          </Card>
        ))}
      </div>

      <div className={styles.searchRow}>
        <SearchInput
          placeholder="Search customer or site..."
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
          <Button variant="secondary" size="sm" onClick={() => load(category)}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          rowClassName={() => (isHiddenView ? styles.trHidden : "")}
          emptyMessage={
            search ? `No results for "${search}"` : "Nothing here."
          }
          itemsPerPage={25}
        />
      )}

      {confirmJob && (
        <ConfirmQuoteModal
          job={confirmJob}
          category={category}
          onConfirm={handleCreateQuote}
          onCancel={() => setConfirmJob(null)}
          creating={creating}
        />
      )}
      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}
    </div>
  );
}
