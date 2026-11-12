"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import SettingsPage, { ReportsMenu, useHashRoute } from "./settings/SettingsPage";
import { SettingsCtx, useSettingsStore } from "./settings/store";
import styles from "./ReportSelector.module.css";
import Card from "@/components/ui/Card";
import CountBadge from "@/components/ui/CountBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// Each report builder is a large, self-contained editor — loading them all
// unconditionally nearly tripled this page's bundle for no reason, since a
// visit only ever uses one. Loading whichever one is picked, on demand,
// keeps the initial /reports visit light.
const JobOverviewPage = dynamic(
  () => import("./condition/ConditionReportPage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const AnchorInspectionPage = dynamic(
  () => import("./anchor-inspection/AnchorInspectionPage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const InspectionReportPage = dynamic(
  () => import("./inspection/InspectionReportPage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const HoursBreakdownPage = dynamic(
  () => import("./hours-breakdown/HoursBreakdownPage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const WeekSchedulePage = dynamic(
  () => import("./week-schedule/WeekSchedulePage"),
  { loading: () => <ReportLoading />, ssr: false },
);
const ProposalBuilder = dynamic(() => import("./proposal/v3/ProposalBuilder"), {
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
  | "job-overview"
  | "inspection"
  | "anchor-inspection"
  | "hours-breakdown"
  | "week-schedule"
  | "proposal";

interface ReportType {
  id: ReportTypeId;
  label: string;
  description: string;
  available: boolean;
  category: "inspection" | "finance" | "proposal" | "operations";
  icon: React.ReactNode;
}

// ── Report type definitions ────────────────────────────────────────────────
const REPORT_TYPES: ReportType[] = [
  {
    id: "job-overview",
    label: "Job overview",
    description:
      "A job's or quote's photos, scope and hours in one report, with a cover page.",
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
    id: "inspection",
    label: "Inspection report",
    description:
      "Building or roof inspection report, from a job's or quote's coded photo labels (e.g. D10 L2 SH).",
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
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16" y2="16" />
        <line x1="11" y1="8" x2="11" y2="11" />
        <line x1="11" y1="14" x2="11.01" y2="14" />
      </svg>
    ),
  },
  {
    id: "anchor-inspection",
    label: "Anchor inspection",
    description:
      "Roof access & fall prevention systems inspection with aerial map zones and asset register, from a job or quote.",
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
    label: "Hours breakdown",
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
    id: "week-schedule",
    label: "Weekly schedule",
    description:
      "Who is on which site each day this week, from the SimPRO schedule. Copy into Excel or print.",
    available: true,
    category: "operations",
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
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </svg>
    ),
  },
  {
    id: "proposal",
    label: "Master proposal",
    description:
      "Painting or waterproofing proposal from a SimPRO quote: findings, scope, access plan and pricing.",
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
const operationsReports = REPORT_TYPES.filter((r) => r.category === "operations");
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
  const store = useSettingsStore();
  const route = useHashRoute();
  // The section menu renders into the layout's slot, as Caro's does; it's
  // left out while a builder is open so the builder has the width.
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  useEffect(() => setMenuEl(document.getElementById("reports-section-menu")), []);
  // Following a breadcrumb or the menu leaves an open builder (its draft is
  // already saved).
  useEffect(() => {
    const close = () => setActive(null);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);

  if (!active) {
    return (
      <SettingsCtx.Provider value={store}>
        {menuEl && createPortal(<ReportsMenu view={route.view} />, menuEl)}
        {route.view === "new" ? <ReportPicker onSelect={setActive} /> : <SettingsPage view={route.view} path={route.path} />}
      </SettingsCtx.Provider>
    );
  }

  if (active === "job-overview") {
    return <JobOverviewPage onBack={() => setActive(null)} />;
  }

  if (active === "inspection") {
    return <InspectionReportPage onBack={() => setActive(null)} />;
  }

  if (active === "anchor-inspection") {
    return <AnchorInspectionPage onBack={() => setActive(null)} />;
  }

  if (active === "hours-breakdown") {
    return <HoursBreakdownPage onBack={() => setActive(null)} />;
  }

  if (active === "week-schedule") {
    return <WeekSchedulePage onBack={() => setActive(null)} />;
  }

  if (active === "proposal") {
    return <ProposalBuilder onBack={() => setActive(null)} />;
  }

  return null;
}

function ReportPicker({ onSelect: setActive }: { onSelect: (id: ReportTypeId) => void }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Reports</h1>
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
        label="Operations"
        reports={operationsReports}
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
