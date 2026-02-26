"use client";

import { useState, useRef, useEffect } from "react";
import ConditionReportPage from "./condition/ConditionReportPage";
import styles from "./ReportSelector.module.css";

type ReportTypeId =
  | "condition"
  | "waterproofing"
  | "building"
  | "finance-summary"
  | "invoice";

interface ReportType {
  id: ReportTypeId;
  label: string;
  description: string;
  available: boolean;
  category: "inspection" | "finance";
  icon: React.ReactNode;
}

interface SentReport {
  id: string;
  report: string;
  file: string;
  date: string;
}

// ── Mock previously sent data ──────────────────────────────────────────────
const PREVIOUSLY_SENT: SentReport[] = [
  {
    id: "1",
    report: "Condition Report",
    file: "condition-report-ocean-view.pdf",
    date: "12 Feb 2025",
  },
  {
    id: "2",
    report: "Building Inspection",
    file: "building-inspection-marina.pdf",
    date: "05 Feb 2025",
  },
  {
    id: "3",
    report: "Finance Summary",
    file: "finance-summary-q1-2025.pdf",
    date: "01 Feb 2025",
  },
  {
    id: "4",
    report: "Condition Report",
    file: "condition-report-hilton-arcade.pdf",
    date: "28 Jan 2025",
  },
];

const REPORT_TYPES: ReportType[] = [
  {
    id: "condition",
    label: "Condition Report",
    description:
      "Photo-based building condition report with cover page and summary.",
    available: true,
    category: "inspection",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: "waterproofing",
    label: "Waterproofing Inspection",
    description:
      "Detailed waterproofing assessment with defect mapping and recommendations.",
    available: false,
    category: "inspection",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: "building",
    label: "Building Inspection",
    description:
      "Full building inspection covering all structural and cosmetic elements.",
    available: false,
    category: "inspection",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    id: "finance-summary",
    label: "Works Agreement",
    description:
      "Formal works agreement outlining scope, terms, and sign-off for approved jobs.",
    available: false,
    category: "finance",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "invoice",
    label: "Invoice Report",
    description:
      "Branded invoice report for completed works with line item breakdown.",
    available: false,
    category: "finance",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

const inspectionReports = REPORT_TYPES.filter(
  (r) => r.category === "inspection",
);
const financeReports = REPORT_TYPES.filter((r) => r.category === "finance");

// ── Previously Sent Dropdown ───────────────────────────────────────────────
function PreviouslySentDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={styles.dropdownWrap} ref={ref}>
      <button
        className={`${styles.dropdownTrigger} ${open ? styles.dropdownTriggerOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
        Previously Sent
        <svg
          className={`${styles.chevron} ${open ? styles.chevronUp : ""}`}
          width="14"
          height="14"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className={styles.dropdownOverlay}
            onClick={() => setOpen(false)}
          />
          <div className={styles.dropdownPanel}>
            <div className={styles.dropdownHeader}>
              <span className={styles.dropdownHeaderCell}>Report</span>
              <span className={styles.dropdownHeaderCell}>File</span>
              <span className={styles.dropdownHeaderCell}>Date</span>
            </div>
            {PREVIOUSLY_SENT.map((item) => (
              <div key={item.id} className={styles.dropdownRow}>
                <span className={styles.dropdownCell}>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, color: "var(--for-light)" }}
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {item.report}
                </span>
                <span
                  className={`${styles.dropdownCell} ${styles.dropdownFile}`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, color: "var(--primary-500)" }}
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span className={styles.fileLink}>{item.file}</span>
                </span>
                <span
                  className={`${styles.dropdownCell} ${styles.dropdownDate}`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, color: "var(--for-light)" }}
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {item.date}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Category Section ───────────────────────────────────────────────────────
function CategorySection({
  label,
  reports,
  onSelect,
}: {
  label: string;
  reports: ReportType[];
  onSelect: (id: ReportTypeId) => void;
}) {
  return (
    <div className={styles.category}>
      <div className={styles.categoryLabel}>{label}</div>
      <div className={styles.grid}>
        {reports.map((type) => (
          <button
            key={type.id}
            className={`${styles.card} ${!type.available ? styles.cardDisabled : ""}`}
            onClick={() => type.available && onSelect(type.id)}
            disabled={!type.available}
          >
            {!type.available && (
              <span className={styles.comingSoon}>Coming soon</span>
            )}
            <div
              className={`${styles.iconWrap} ${type.available ? styles.iconWrapActive : ""}`}
            >
              {type.icon}
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardLabel}>{type.label}</div>
              <div className={styles.cardDesc}>{type.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ReportSelector() {
  const [active, setActive] = useState<ReportTypeId | null>(null);

  if (active === "condition") {
    return <ConditionReportPage onBack={() => setActive(null)} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Report Builder</h1>
          <p className={styles.subtitle}>Select a report type to get started</p>
        </div>
        <div className={styles.headerRight}>
          <PreviouslySentDropdown />
        </div>
      </div>

      <CategorySection
        label="Inspection"
        reports={inspectionReports}
        onSelect={setActive}
      />
      <CategorySection
        label="Finance"
        reports={financeReports}
        onSelect={setActive}
      />
    </div>
  );
}
