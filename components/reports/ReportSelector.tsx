"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./ReportSelector.module.css";
import Card from "@/components/ui/Card";
import CountBadge from "@/components/ui/CountBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// Each report builder is a large, self-contained editor (Condition Report
// alone pulls in a full Tiptap rich-text engine) — loading all three
// unconditionally nearly tripled this page's bundle for no reason, since a
// visit only ever uses one. Loading whichever one is picked, on demand,
// keeps the initial /reports visit light.
const ConditionReportPage = dynamic(
  () => import("./condition/ConditionReportPage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const AnchorInspectionPage = dynamic(
  () => import("./anchor-inspection/AnchorInspectionPage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const HoursBreakdownPage = dynamic(
  () => import("./hours-breakdown/HoursBreakdownPage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const ProposalPage = dynamic(() => import("./proposal/ProposalPage"), {
  loading: () => <ReportLoading />,
  ssr: false,
});

function ReportLoading() {
  return (
    <div className={styles.loadingState}>
      <LoadingSpinner />
    </div>
  );
}

type ReportTypeId =
  | "condition"
  | "anchor-inspection"
  | "hours-breakdown"
  | "proposal";

interface ReportType {
  id: ReportTypeId;
  label: string;
  description: string;
  available: boolean;
  category: "inspection" | "finance" | "proposal";
  icon: React.ReactNode;
}

// ── Report type definitions ────────────────────────────────────────────────
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
    id: "anchor-inspection",
    label: "Anchor Inspection",
    description:
      "Roof access & fall prevention systems inspection with aerial map zones and asset register.",
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
        <circle cx="12" cy="10" r="3" />
        <path d="M12 2a8 8 0 00-8 8c0 5.25 8 14 8 14s8-8.75 8-14a8 8 0 00-8-8z" />
      </svg>
    ),
  },
  {
    id: "hours-breakdown",
    label: "Hours Breakdown",
    description:
      "Labour hours report by employee and date, filterable by date range.",
    available: true,
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
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "proposal",
    label: "Proposal",
    description:
      "Rich sales proposal with findings, scope, access plan and pricing.",
    available: true,
    category: "proposal",
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
        <path d="M9 12h6M9 16h6M9 8h1" />
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
];

const inspectionReports = REPORT_TYPES.filter(
  (r) => r.category === "inspection",
);
const financeReports = REPORT_TYPES.filter((r) => r.category === "finance");
const proposalReports = REPORT_TYPES.filter((r) => r.category === "proposal");

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
          <Card
            key={type.id}
            interactive={type.available}
            onClick={type.available ? () => onSelect(type.id) : undefined}
            padding="lg"
            className={`${styles.card} ${!type.available ? styles.cardDisabled : ""}`}
          >
            {!type.available && (
              <CountBadge
                variant="neutral"
                label="Coming soon"
                className={styles.comingSoon}
              />
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
          </Card>
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

  if (active === "anchor-inspection") {
    return <AnchorInspectionPage onBack={() => setActive(null)} />;
  }

  if (active === "hours-breakdown") {
    return <HoursBreakdownPage onBack={() => setActive(null)} />;
  }

  if (active === "proposal") {
    return <ProposalPage onBack={() => setActive(null)} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Report Builder</h1>
        <p className={styles.subtitle}>Select a report type to get started</p>
      </div>

      <CategorySection
        label="Inspection"
        reports={inspectionReports}
        onSelect={setActive}
      />
      <CategorySection
        label="Proposal"
        reports={proposalReports}
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
