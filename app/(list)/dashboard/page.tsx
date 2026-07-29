"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import styles from "./page.module.css";
import { RECURRING_CATEGORY_LIST } from "@/lib/recertifications/categories";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [dueCount, setDueCount] = useState<number | null>(null);

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
            sum +
            (r.jobs ?? []).filter((j) => j.status !== "upcoming").length,
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
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroEyebrow}>RAS-VERTEX</span>
          <h1 className={styles.heroTitle}>{getGreeting()}</h1>
        </div>

        <div className={styles.heroCards}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Jobs due or overdue</span>
            <span className={styles.statValue}>
              {dueCount === null ? "—" : dueCount}
            </span>
            <Link href="/recurring-jobs" className={styles.statLink}>
              View
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.tiles}>
        <Card href="/reports" className={styles.tile}>
          <span className={styles.tileTitle}>Reports</span>
          <p className={styles.tileDescription}>
            Build a condition, hours breakdown, or anchor inspection report.
          </p>
        </Card>

        <Card href="/recurring-jobs" className={styles.tile}>
          <span className={styles.tileTitle}>Recurring Jobs</span>
          <p className={styles.tileDescription}>
            Track height safety, window cleaning, and building cleaning
            recertifications due for renewal.
          </p>
        </Card>
      </div>
    </div>
  );
}
