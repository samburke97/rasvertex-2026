"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./WorksAgreementPage.module.css";
import Button from "@/components/ui/Button";
import { buildWorksAgreementHTML } from "@/lib/reports/works-agreement/pdf";
import type { WorksAgreementData } from "@/lib/reports/works-agreement/types";

interface WorksAgreementPageProps {
  onBack: () => void;
}

type View = "list" | "editor" | "create";

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: WorksAgreementData["status"] }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Trigger badge ─────────────────────────────────────────────────────────
function TriggerBadge({ by }: { by: WorksAgreementData["triggeredBy"] }) {
  return (
    <span
      className={`${styles.trigger} ${by === "webhook" ? styles.triggerAuto : styles.triggerManual}`}
    >
      {by === "webhook" ? (
        <>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Auto
        </>
      ) : (
        <>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Manual
        </>
      )}
    </span>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────
function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (a: WorksAgreementData) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    jobId: "",
    jobNo: "",
    jobName: "",
    clientName: "",
    siteAddress: "",
    siteName: "",
    initialWorks: "",
    colourScheme: "To be advised",
    totalIncGst: "",
    date: new Date().toLocaleDateString("en-AU"),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof fields, v: string) =>
    setFields((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!fields.jobId || !fields.totalIncGst) {
      setError("Job ID and Total Inc GST are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/works-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          totalIncGst: parseFloat(fields.totalIncGst),
        }),
      });
      if (res.status === 409) {
        setError("A works agreement already exists for this job ID.");
        return;
      }
      if (!res.ok) throw new Error("Failed to create");
      const { agreement } = await res.json();
      onCreated(agreement);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fields_config = [
    {
      key: "jobId" as const,
      label: "SimPRO Job ID *",
      placeholder: "e.g. 10857",
      type: "text",
    },
    { key: "jobNo" as const, label: "Job Number", placeholder: "e.g. #10857" },
    {
      key: "jobName" as const,
      label: "Job Name",
      placeholder: "e.g. Building Wash & Paint Touch Ups",
    },
    {
      key: "clientName" as const,
      label: "Client Name",
      placeholder: "e.g. The Mirage Alexandra Headland",
    },
    {
      key: "siteName" as const,
      label: "Site Name",
      placeholder: "e.g. The Mirage",
    },
    {
      key: "siteAddress" as const,
      label: "Site Address",
      placeholder: "e.g. 6 Mari Street, Alexandra Headland, QLD",
    },
    {
      key: "totalIncGst" as const,
      label: "Total Inc GST *",
      placeholder: "e.g. 34804.00",
      type: "number",
    },
    { key: "date" as const, label: "Date", placeholder: "DD/MM/YYYY" },
    {
      key: "colourScheme" as const,
      label: "Colour Scheme",
      placeholder: "To be advised",
    },
  ];

  return (
    <div className={styles.createForm}>
      <div className={styles.createFormHeader}>
        <h3 className={styles.createFormTitle}>New Works Agreement</h3>
        <p className={styles.createFormSub}>
          Manually create an agreement for any job
        </p>
      </div>

      <div className={styles.fieldGrid}>
        {fields_config.map(({ key, label, placeholder, type }) => (
          <div key={key} className={styles.fieldRow}>
            <label className={styles.fieldLabel}>{label}</label>
            <input
              type={type || "text"}
              value={fields[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              className={styles.fieldInput}
            />
          </div>
        ))}

        <div className={`${styles.fieldRow} ${styles.fieldRowFull}`}>
          <label className={styles.fieldLabel}>Initial Works</label>
          <textarea
            value={fields.initialWorks}
            onChange={(e) => set("initialWorks", e.target.value)}
            placeholder="Describe the scope of works..."
            className={styles.fieldTextarea}
            rows={4}
          />
        </div>
      </div>

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Creating…" : "Create Agreement"}
        </Button>
      </div>
    </div>
  );
}

// ── Editor: review + export a single agreement ────────────────────────────
function AgreementEditor({
  agreement: initial,
  onBack,
  onUpdated,
}: {
  agreement: WorksAgreementData;
  onBack: () => void;
  onUpdated: (a: WorksAgreementData) => void;
}) {
  const [data, setData] = useState<WorksAgreementData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof WorksAgreementData, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const updatePayment = (
    idx: number,
    field: "percentage" | "description",
    raw: string,
  ) => {
    const schedule = [...data.paymentSchedule];
    const item = { ...schedule[idx] };
    if (field === "percentage") {
      const pct = parseFloat(raw) || 0;
      item.percentage = pct;
      item.value = Math.round((pct / 100) * data.totalIncGst * 100) / 100;
    } else {
      item.description = raw;
    }
    schedule[idx] = item;
    setData((prev) => ({ ...prev, paymentSchedule: schedule }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/works-agreements/${data.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      const { agreement } = await res.json();
      onUpdated(agreement);
      setSaved(true);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildWorksAgreementHTML(data));
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(v);

  const scheduleTotal = data.paymentSchedule.reduce((s, p) => s + p.value, 0);
  const totalMismatch = Math.abs(scheduleTotal - data.totalIncGst) > 0.5;

  return (
    <div className={styles.editor}>
      {/* Top bar */}
      <div className={styles.editorTopBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← All agreements
        </button>
        <div className={styles.editorTopRight}>
          <StatusBadge status={data.status} />
          <TriggerBadge by={data.triggeredBy} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
          </Button>
          <Button variant="primary" size="sm" onClick={handleExport}>
            Export PDF
          </Button>
        </div>
      </div>

      {/* Page header */}
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>Works Agreement</h2>
        <p className={styles.editorSub}>
          Job {data.jobNo} · {data.clientName}
        </p>
      </div>

      {/* Sections */}
      <div className={styles.sections}>
        {/* Job details */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Schedule Details</div>
          <div className={styles.sectionCard}>
            <div className={styles.detailGrid}>
              {[
                { label: "1. Date", key: "date" as const },
                { label: "2. Client", key: "clientName" as const },
                { label: "4. Site Address", key: "siteAddress" as const },
                { label: "6. Colour Scheme", key: "colourScheme" as const },
              ].map(({ label, key }) => (
                <div key={key} className={styles.detailRow}>
                  <div className={styles.detailLabel}>{label}</div>
                  <input
                    className={styles.detailInput}
                    value={String(data[key])}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </div>
              ))}
              <div className={`${styles.detailRow} ${styles.detailRowFull}`}>
                <div className={styles.detailLabel}>5. Initial Works</div>
                <textarea
                  className={styles.detailTextarea}
                  value={data.initialWorks}
                  onChange={(e) => update("initialWorks", e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Financials + payment schedule */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>7. Payment Schedule</div>
          <div className={styles.sectionCard}>
            {/* Total input */}
            <div className={styles.totalRow}>
              <div className={styles.totalLabel}>8. Total Price Inc GST</div>
              <div className={styles.totalInputWrap}>
                <span className={styles.totalPrefix}>$</span>
                <input
                  type="number"
                  className={styles.totalInput}
                  value={data.totalIncGst}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    // Recalculate all payment values proportionally
                    const schedule = data.paymentSchedule.map((p) => ({
                      ...p,
                      value: Math.round((p.percentage / 100) * val * 100) / 100,
                    }));
                    setData((prev) => ({
                      ...prev,
                      totalIncGst: val,
                      paymentSchedule: schedule,
                    }));
                    setSaved(false);
                  }}
                />
                <span className={styles.totalHint}>
                  {data.totalIncGst > 100000
                    ? "6-payment schedule"
                    : "5-payment schedule"}
                </span>
              </div>
            </div>

            {totalMismatch && (
              <div className={styles.mismatchWarning}>
                ⚠ Payment total ({formatCurrency(scheduleTotal)}) doesn't match
                job total. Adjust percentages to balance.
              </div>
            )}

            {/* Payment rows */}
            <div className={styles.paymentTable}>
              <div className={styles.paymentHeader}>
                <span className={styles.paymentHeaderCell}>Payment</span>
                <span className={styles.paymentHeaderCell}>%</span>
                <span className={styles.paymentHeaderCell}>Value</span>
                <span
                  className={`${styles.paymentHeaderCell} ${styles.paymentHeaderDesc}`}
                >
                  Description
                </span>
              </div>

              {data.paymentSchedule.map((p, i) => (
                <div key={i} className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>{p.label}</span>
                  <div className={styles.paymentPct}>
                    <input
                      type="number"
                      value={p.percentage}
                      onChange={(e) =>
                        updatePayment(i, "percentage", e.target.value)
                      }
                      className={styles.paymentPctInput}
                    />
                    <span className={styles.paymentPctSymbol}>%</span>
                  </div>
                  <span className={styles.paymentValue}>
                    {formatCurrency(p.value)}
                  </span>
                  <input
                    type="text"
                    value={p.description}
                    onChange={(e) =>
                      updatePayment(i, "description", e.target.value)
                    }
                    className={styles.paymentDesc}
                  />
                </div>
              ))}

              {/* Schedule total */}
              <div className={`${styles.paymentRow} ${styles.paymentTotalRow}`}>
                <span className={styles.paymentLabel}>Total</span>
                <span className={styles.paymentPct}>
                  {data.paymentSchedule.reduce((s, p) => s + p.percentage, 0)}%
                </span>
                <span
                  className={`${styles.paymentValue} ${totalMismatch ? styles.paymentValueMismatch : ""}`}
                >
                  {formatCurrency(scheduleTotal)}
                </span>
                <span className={styles.paymentDesc} />
              </div>
            </div>
          </div>
        </section>

        {/* Status update */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Agreement Status</div>
          <div className={styles.sectionCard}>
            <div className={styles.statusRow}>
              {(["draft", "sent", "accepted"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => update("status", s)}
                  className={`${styles.statusBtn} ${data.status === s ? styles.statusBtnActive : ""}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WorksAgreementPage({
  onBack,
}: WorksAgreementPageProps) {
  const [view, setView] = useState<View>("list");
  const [agreements, setAgreements] = useState<WorksAgreementData[]>([]);
  const [selected, setSelected] = useState<WorksAgreementData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAgreements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/works-agreements");
      const { agreements: data } = await res.json();
      setAgreements(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgreements();
  }, [loadAgreements]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(v);

  // ── Views ────────────────────────────────────────────────────────────────

  if (view === "editor" && selected) {
    return (
      <AgreementEditor
        agreement={selected}
        onBack={() => {
          setView("list");
          setSelected(null);
        }}
        onUpdated={(updated) => {
          setSelected(updated);
          setAgreements((prev) =>
            prev.map((a) => (a.jobId === updated.jobId ? updated : a)),
          );
        }}
      />
    );
  }

  if (view === "create") {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => setView("list")}>
            ← All agreements
          </button>
        </div>
        <CreateForm
          onCreated={(a) => {
            setAgreements((prev) => [a, ...prev]);
            setSelected(a);
            setView("editor");
          }}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Report types
        </button>
        <Button variant="primary" size="sm" onClick={() => setView("create")}>
          + New Agreement
        </Button>
      </div>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Works Agreements</h1>
        <p className={styles.pageSub}>
          Auto-generated for jobs ≥ $20,000 · Review and export as PDF
        </p>
      </div>

      {/* Webhook info banner */}
      <div className={styles.infoBanner}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span>
          SimPRO webhook active — agreements are automatically created when jobs
          ≥ $20,000 are raised.
          <a
            href="https://your-domain.com/api/webhooks/simpro"
            className={styles.webhookUrl}
          >
            /api/webhooks/simpro
          </a>
        </span>
      </div>

      {loading ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Loading agreements…</p>
        </div>
      ) : agreements.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M9 15l2 2 4-4" />
            </svg>
          </div>
          <p className={styles.emptyTitle}>No agreements yet</p>
          <p className={styles.emptyText}>
            Agreements appear here automatically when jobs ≥ $20,000 are created
            in SimPRO, or create one manually.
          </p>
          <Button variant="primary" onClick={() => setView("create")}>
            Create manually
          </Button>
        </div>
      ) : (
        <div className={styles.agreementList}>
          {agreements.map((a) => (
            <button
              key={a.jobId}
              className={styles.agreementCard}
              onClick={() => {
                setSelected(a);
                setView("editor");
              }}
            >
              <div className={styles.cardLeft}>
                <div className={styles.cardIcon}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M9 15l2 2 4-4" />
                  </svg>
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardTitle}>{a.jobName}</div>
                  <div className={styles.cardMeta}>
                    {a.jobNo} · {a.clientName} · {a.siteAddress}
                  </div>
                </div>
              </div>
              <div className={styles.cardRight}>
                <div className={styles.cardTotal}>
                  {formatCurrency(a.totalIncGst)}
                </div>
                <div className={styles.cardBadges}>
                  <StatusBadge status={a.status} />
                  <TriggerBadge by={a.triggeredBy} />
                </div>
                <div className={styles.cardDate}>{a.date}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
