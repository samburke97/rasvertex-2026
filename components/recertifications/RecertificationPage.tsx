"use client";
// components/recertifications/RecertificationPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import styles from "./RecertificationPage.module.css";
import type { RecertificationJob } from "@/app/api/simpro/recertifications/route";

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

// ── Confirmation Modal ────────────────────────────────────────────────────
interface ConfirmModalProps {
  job: RecertificationJob;
  onConfirm: () => void;
  onCancel: () => void;
  creating: boolean;
}

function ConfirmModal({
  job,
  onConfirm,
  onCancel,
  creating,
}: ConfirmModalProps) {
  const currentYear = new Date().getFullYear();
  const dueYear = new Date(job.nextDueDate).getFullYear();
  const nextYear = Math.max(dueYear, currentYear);
  const newExTax = Math.round(job.totalExTax * 1.05 * 100) / 100;
  const newIncTax = Math.round(newExTax * 1.1 * 100) / 100;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const dueDateStr = dueDate.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Create Recertification Quote</h3>
          <button className={styles.modalClose} onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalWarning}>
            This will create a real quote in SimPRO. Please confirm all details
            are correct.
          </p>

          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Quote Name</span>
            <span className={styles.modalValue}>
              Anchor Recertification - {nextYear}
            </span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Customer</span>
            <span className={styles.modalValue}>{job.customer}</span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Site</span>
            <span className={styles.modalValue}>{job.site}</span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Based on Job</span>
            <span className={styles.modalValue}>
              {job.name} #{job.id}
            </span>
          </div>
          <div className={styles.modalDivider} />
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Last Year Ex Tax</span>
            <span className={styles.modalValue}>
              {formatCurrency(job.totalExTax)}
            </span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>New Price Ex Tax (+5%)</span>
            <span
              className={`${styles.modalValue} ${styles.modalValueHighlight}`}
            >
              {formatCurrency(newExTax)}
            </span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>New Price Inc GST</span>
            <span className={styles.modalValue}>
              {formatCurrency(newIncTax)}
            </span>
          </div>
          <div className={styles.modalDivider} />
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Due Date</span>
            <span className={styles.modalValue}>{dueDateStr} (14 days)</span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Type</span>
            <span className={styles.modalValue}>Service</span>
          </div>
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
            {creating ? "Creating…" : "Create Quote in SimPRO"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success toast ─────────────────────────────────────────────────────────
interface ToastProps {
  message: string;
  onClose: () => void;
}

function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={styles.toast}>
      <span className={styles.toastIcon}>✓</span>
      {message}
      <button className={styles.toastClose} onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function RecertificationPage() {
  const [jobs, setJobs] = useState<RecertificationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "overdue" | "due-soon" | "upcoming"
  >("all");
  const [confirmJob, setConfirmJob] = useState<RecertificationJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simpro/recertifications");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch {
      setError("Could not load recertification data. Check SimPRO connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
          lastExTax: confirmJob.totalExTax,
          nextDueDate: confirmJob.nextDueDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create quote");
      }

      const result = await res.json();
      setCreatedIds((prev) => new Set([...prev, confirmJob.id]));
      setToast(`Quote created in SimPRO — ${result.quoteName}`);
      setConfirmJob(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setCreating(false);
    }
  };

  const filtered =
    filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const counts = {
    all: jobs.length,
    overdue: jobs.filter((j) => j.status === "overdue").length,
    "due-soon": jobs.filter((j) => j.status === "due-soon").length,
    upcoming: jobs.filter((j) => j.status === "upcoming").length,
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Anchor Recertifications</h1>
          <p className={styles.subtitle}>
            Height Safety jobs due for annual recertification — completed date +
            1 year
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {/* Summary cards */}
      <div className={styles.cards}>
        <div className={`${styles.card} ${styles.cardOverdue}`}>
          <span className={styles.cardCount}>{counts.overdue}</span>
          <span className={styles.cardLabel}>Overdue</span>
        </div>
        <div className={`${styles.card} ${styles.cardDueSoon}`}>
          <span className={styles.cardCount}>{counts["due-soon"]}</span>
          <span className={styles.cardLabel}>Due within 60 days</span>
        </div>
        <div className={`${styles.card} ${styles.cardUpcoming}`}>
          <span className={styles.cardCount}>{counts.upcoming}</span>
          <span className={styles.cardLabel}>Upcoming</span>
        </div>
        <div className={`${styles.card} ${styles.cardTotal}`}>
          <span className={styles.cardCount}>{counts.all}</span>
          <span className={styles.cardLabel}>Total</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.filters}>
        {(["all", "overdue", "due-soon", "upcoming"] as const).map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? "All"
              : f === "due-soon"
                ? "Due Soon"
                : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={styles.filterCount}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <div className={styles.errorState}>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={load}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Fetching from SimPRO…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No jobs found{filter !== "all" ? ` for "${filter}"` : ""}.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Job</th>
                <th className={styles.th}>Customer</th>
                <th className={styles.th}>Site</th>
                <th className={styles.th}>Last Completed</th>
                <th className={styles.th}>Next Due</th>
                <th className={styles.th}>Last Price</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const alreadyCreated = createdIds.has(job.id);
                return (
                  <tr
                    key={job.id}
                    className={`${styles.tr} ${job.status === "overdue" ? styles.trOverdue : ""}`}
                  >
                    <td className={styles.td}>
                      <span className={styles.jobName}>{job.name}</span>
                      <span className={styles.jobId}>#{job.id}</span>
                    </td>
                    <td className={styles.td}>{job.customer}</td>
                    <td className={styles.td}>{job.site}</td>
                    <td className={styles.td}>
                      {formatDate(job.completedDate)}
                    </td>
                    <td className={styles.td}>
                      <span
                        className={
                          job.status === "overdue" ? styles.dateOverdue : ""
                        }
                      >
                        {formatDate(job.nextDueDate)}
                      </span>
                    </td>
                    <td className={styles.td}>
                      {formatCurrency(job.totalExTax)} ex
                    </td>
                    <td className={styles.td}>
                      <StatusPill status={job.status} days={job.daysUntilDue} />
                    </td>
                    <td className={styles.td}>
                      {alreadyCreated ? (
                        <span className={styles.createdBadge}>✓ Created</span>
                      ) : (
                        <button
                          className={styles.createBtn}
                          onClick={() => setConfirmJob(job)}
                        >
                          Create Quote
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmJob && (
        <ConfirmModal
          job={confirmJob}
          onConfirm={handleCreateQuote}
          onCancel={() => setConfirmJob(null)}
          creating={creating}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
