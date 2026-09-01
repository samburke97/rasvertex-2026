"use client";
// components/dashboard/ReportingDashboard.tsx
//
// KPI grid + revenue charts + an overdue-invoices table, matching
// reporting-dashboard.html's structure. Only the first KPI card (jobs due
// or overdue) is real data, reused from the dashboard page this replaces —
// there's no invoice/revenue data source anywhere in this app or its Simpro
// integration, so every other number here is a hardcoded placeholder and is
// visibly labelled "Demo" rather than presented as this business's actual
// figures. Dark mode is a single global toggle (top nav, see MainLayout) —
// this page just consumes the app-wide --rv-* tokens like everything else.

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./ReportingDashboard.module.css";
import { RECURRING_CATEGORY_LIST } from "@/lib/recertifications/categories";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const TIME_RANGES = ["This week", "This month", "This quarter", "This year"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

function DemoBadge() {
  return <span className={styles.demoBadge}>Demo</span>;
}

export default function ReportingDashboard() {
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [range, setRange] = useState<TimeRange>("This month");
  const [insightDismissed, setInsightDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          RECURRING_CATEGORY_LIST.map((c) =>
            fetch(`/api/simpro/recertifications?category=${c.id}`).then(
              (r) => (r.ok ? r.json() : { jobs: [] }),
            ),
          ),
        );
        if (cancelled) return;
        const count = results.reduce(
          (sum: number, r: { jobs?: { status: string }[] }) =>
            sum + (r.jobs ?? []).filter((j) => j.status !== "upcoming").length,
          0,
        );
        setDueCount(count);
      } catch {
        if (!cancelled) setDueCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{getGreeting()}.</h1>
          <p className={styles.subtitle}>Here&apos;s how the business is tracking {range.toLowerCase()}.</p>
        </div>
        <div className={styles.headerTools}>
          <div className={styles.segment}>
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={r === range ? styles.segOn : ""}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!insightDismissed && (
        <div className={styles.insight}>
          <div className={styles.insightIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p>
            <strong>These charts and figures are demo data</strong> — connect real revenue and
            invoicing to replace them.
          </p>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setInsightDismissed(true)}
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={styles.kpiIcon}>
              <path
                d="M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 9.5h18M8 3v3.5M16 3v3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Jobs due or overdue</span>
            <span className={styles.kpiValue}>{dueCount === null ? "—" : dueCount}</span>
          </div>
          <Link href="/recurring-jobs" className={styles.kpiLink}>
            View
          </Link>
        </div>

        <DemoKpiCard
          label="Revenue this month"
          value="$386,200"
          delta="+14% vs last month"
          good
          points="0,22 8,16.3 16,19.1 24,13.4 32,14.9 40,7.7 48,9.1 56,2"
        />
        <DemoKpiCard
          label="Average job value"
          value="$18,240"
          delta="+6% vs last quarter"
          good
          points="0,19.8 8,22 16,15.3 24,17.6 32,10.9 40,13.1 48,6.4 56,2"
        />
        <DemoKpiCard
          label="Open pipeline value"
          value="$1.24M"
          delta="+9% vs last month"
          good
          points="0,22 8,16.5 16,18.4 24,11.1 32,14.7 40,5.6 48,7.5 56,2"
        />
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Revenue by month</h3>
            <DemoBadge />
          </div>
          <RevenueChart />
          <div className={styles.monthLabels}>
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Where revenue comes from</h3>
            <DemoBadge />
          </div>
          <RevenueDonut />
        </div>
      </div>

      <div className={styles.invoicesSection}>
        <div className={styles.sectionHead}>
          <div>
            <h3>Overdue invoices</h3>
            <p>Example data — connect real invoicing to replace this.</p>
          </div>
          <DemoBadge />
        </div>

        <div className={styles.agingGrid}>
          <AgingCard label="Current" amount="$142,600" count="12 invoices" />
          <AgingCard label="1–30 days" amount="$43,640" count="3 invoices" />
          <AgingCard label="31–60 days" amount="$24,360" count="2 invoices" />
          <AgingCard label="61–90+ days" amount="$18,240" count="1 invoice" warn />
        </div>

        <InvoicesTable />
      </div>
    </div>
  );
}

// ── KPI card (demo) ──────────────────────────────────────────────────────────

function DemoKpiCard({
  label,
  value,
  delta,
  good,
  points,
}: {
  label: string;
  value: string;
  delta: string;
  good: boolean;
  points: string;
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiTop}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={styles.kpiIcon}>
          <path
            d="M3 17L9 11L13 15L21 7M21 7H15M21 7V13"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg width="56" height="24" viewBox="0 0 56 24" fill="none">
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            className={styles.sparkline}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className={styles.kpiBody}>
        <span className={styles.kpiLabel}>
          {label} <DemoBadge />
        </span>
        <span className={styles.kpiValue}>{value}</span>
      </div>
      <span className={`${styles.kpiDelta} ${good ? styles.deltaGood : styles.deltaBad}`}>{delta}</span>
    </div>
  );
}

// ── Charts (hand-rolled SVG, no charting dependency) ─────────────────────────

function RevenueChart() {
  const path =
    "M 10 122.9 C 57 122.9, 57 83.2, 104 83.2 C 151 83.2, 151 55.8, 199 55.8 C 246 55.8, 246 139.7, 293 139.7 C 340 139.7, 340 158, 387 158 C 434 158, 434 190, 481 190 C 529 190, 529 148.8, 576 148.8 C 623 148.8, 623 10, 670 10";
  const points = [
    [10, 122.9],
    [104, 83.2],
    [199, 55.8],
    [293, 139.7],
    [387, 158],
    [481, 190],
    [576, 148.8],
    [670, 10],
  ];
  return (
    <svg viewBox="0 0 680 200" preserveAspectRatio="none" className={styles.areaChart}>
      <defs>
        <linearGradient id="rvAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dash-brand)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--dash-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[10, 55, 100, 145, 190].map((y) => (
        <line key={y} x1="0" y1={y} x2="680" y2={y} stroke="var(--dash-grid-line)" strokeWidth="1" />
      ))}
      <path d={`${path} L 670 200 L 10 200 Z`} fill="url(#rvAreaFill)" stroke="none" />
      <path d={path} fill="none" stroke="var(--dash-brand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 5 : 3.5}
          fill="var(--dash-brand)"
          stroke="var(--dash-card)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

const DONUT_SEGMENTS = [
  { name: "Body Corporate Painting", pct: 34, color: "#1f6d4c" },
  { name: "Commercial Painting", pct: 22, color: "#6e8ca0" },
  { name: "Height Safety & Rope Access", pct: 18, color: "#3d6b9e" },
  { name: "Waterproofing", pct: 12, color: "#8aacc9" },
  { name: "External Cleaning", pct: 9, color: "#5b8ab8" },
  { name: "Building Inspections", pct: 5, color: "#c3d4e3" },
];

function RevenueDonut() {
  const circumference = 2 * Math.PI * 80;
  let offset = 0;
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut}>
        <svg width="150" height="150" viewBox="0 0 200 200">
          {DONUT_SEGMENTS.map((seg) => {
            const dash = (seg.pct / 100) * circumference;
            const el = (
              <circle
                key={seg.name}
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke={seg.color}
                strokeWidth="24"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 100 100)"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className={styles.donutCenter}>
          <span className={styles.donutBig}>$2.56M</span>
          <span className={styles.donutSmall}>FY revenue</span>
        </div>
      </div>
      <div className={styles.legendList}>
        {DONUT_SEGMENTS.map((seg) => (
          <div key={seg.name} className={styles.legendRow}>
            <span className={styles.legendSq} style={{ background: seg.color }} />
            <span className={styles.legendName}>{seg.name}</span>
            <span className={styles.legendPct}>{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overdue invoices (demo) ──────────────────────────────────────────────────

function AgingCard({
  label,
  amount,
  count,
  warn,
}: {
  label: string;
  amount: string;
  count: string;
  warn?: boolean;
}) {
  return (
    <div className={styles.agingCard}>
      <span className={styles.agingLabel}>{label}</span>
      <span className={`${styles.agingAmount} ${warn ? styles.agingAmountWarn : ""}`}>{amount}</span>
      <span className={styles.agingCount}>{count}</span>
    </div>
  );
}

interface DemoInvoice {
  initials: string;
  name: string;
  suburb: string;
  invoice: string;
  amount: string;
  overdue: string;
  status: "overdue" | "duesoon";
}

const DEMO_INVOICES: DemoInvoice[] = [
  { initials: "SC", name: "Sandpiper Cove Body Corporate", suburb: "Mooloolaba", invoice: "INV-4821", amount: "$18,240", overdue: "62 days", status: "overdue" },
  { initials: "OR", name: "Oceanvue Residences", suburb: "Maroochydore", invoice: "INV-4867", amount: "$9,860", overdue: "41 days", status: "overdue" },
  { initials: "PS", name: "Peregian Springs Village SC", suburb: "Peregian Springs", invoice: "INV-4902", amount: "$14,500", overdue: "35 days", status: "overdue" },
  { initials: "BC", name: "Buderim Central Body Corp", suburb: "Buderim", invoice: "INV-4915", amount: "$6,220", overdue: "28 days", status: "duesoon" },
  { initials: "NQ", name: "Noosa Quays Body Corporate", suburb: "Noosaville", invoice: "INV-4933", amount: "$22,400", overdue: "19 days", status: "duesoon" },
];

function InvoicesTable() {
  return (
    <div className={styles.table}>
      <div className={styles.tableHead}>
        <span>Client</span>
        <span>Invoice</span>
        <span>Amount</span>
        <span>Overdue</span>
        <span>Status</span>
      </div>
      {DEMO_INVOICES.map((inv) => (
        <div key={inv.invoice} className={styles.tableRow}>
          <div className={styles.clientCell}>
            <div
              className={styles.clientAvatar}
              style={
                inv.status === "overdue"
                  ? { background: "var(--dash-red-tint)", color: "var(--dash-red)" }
                  : { background: "var(--dash-green-tint)", color: "var(--dash-brand)" }
              }
            >
              {inv.initials}
            </div>
            <div className={styles.clientInfo}>
              <span className={styles.clientName}>{inv.name}</span>
              <span className={styles.clientSuburb}>{inv.suburb}</span>
            </div>
          </div>
          <span className={styles.cellSecondary}>{inv.invoice}</span>
          <span className={styles.cellStrong}>{inv.amount}</span>
          <span className={styles.cellSecondary}>{inv.overdue}</span>
          <span className={`${styles.statusPill} ${inv.status === "overdue" ? styles.statusOverdue : styles.statusDuesoon}`}>
            {inv.status === "overdue" ? "Overdue" : "Due soon"}
          </span>
        </div>
      ))}
    </div>
  );
}
