"use client";
// components/reports/condition/sections/CoverSection.tsx

import React from "react";
import styles from "./CoverSection.module.css";
import EditableField from "../../shared/EditableField";
import type { ReportJobDetails } from "@/lib/reports/condition.types";

interface CoverSectionProps {
  job: ReportJobDetails;
  onChange: (field: keyof ReportJobDetails, value: string) => void;
}

const META_ROWS: { label: string; field: keyof ReportJobDetails }[] = [
  { label: "Prepared For", field: "preparedFor" },
  { label: "Prepared By", field: "preparedBy" },
  { label: "Address", field: "address" },
  { label: "Project", field: "project" },
  { label: "Date", field: "date" },
];

export default function CoverSection({ job, onChange }: CoverSectionProps) {
  return (
    <div className={styles.page}>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        {/* Layer 1 — solid navy base, always visible */}
        <div className={styles.heroNavy} />

        {/* Layer 2 — cover photo (only when provided) */}
        {job.coverPhoto && (
          <div
            className={styles.heroCoverPhoto}
            style={{ backgroundImage: `url(${job.coverPhoto})` }}
          />
        )}

        {/* Layer 3 — dark blue tint overlay, always on top of photo */}
        <div className={styles.heroOverlay} />

        {/* Layer 4 — white chevron shape cut out at the bottom */}
        {/*
          The chevron is a white element using clip-path to create the
          upward-pointing V shape. Three points:
            - bottom-left corner  (0%, 100%)
            - center peak         (~32% from left, ~62% height)
            - bottom-right corner (100%, 100%)
          This is positioned absolutely at the bottom of the hero.
        */}
        <div className={styles.heroChevron} />

        {/* ── Content (all z-index above the layers) ── */}

        {/* Top-left: RAS Vertex logo */}
        <div className={styles.heroLogo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/ras-logo.png"
            alt="RAS Vertex Maintenance Solutions"
            className={styles.heroLogoImg}
          />
        </div>

        {/* Top-right: website link image */}
        <div className={styles.heroWeb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/link_white.png"
            alt="rasvertex.com.au"
            className={styles.heroWebImg}
          />
        </div>

        {/* Bottom-right: QBCC / ABN in Bebas */}
        <div className={styles.heroCreds}>
          <div className={styles.heroCredsItem}>
            <span className={styles.heroCredsKey}>QBCC:</span>
            <span className={styles.heroCredsVal}> 1307234</span>
          </div>
          <div className={styles.heroCredsItem}>
            <span className={styles.heroCredsKey}>ABN:</span>
            <span className={styles.heroCredsVal}> 53 167 652 637</span>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className={styles.body}>
        {/* Editable title in Bebas */}
        <h1 className={styles.reportTitle}>
          <EditableField
            value={job.reportType}
            onChange={(v) => onChange("reportType", v)}
            placeholder="Report Title"
            label="Report Title"
          />
        </h1>

        <p className={styles.intro}>
          This report outlines the repairs and maintenance works completed,
          including any updates, adjustments, and variations from the original
          scope.
        </p>

        {/* Meta table */}
        <dl className={styles.meta}>
          {META_ROWS.map(({ label, field }) => (
            <div key={field} className={styles.metaRow}>
              <dt className={styles.metaLabel}>{label}</dt>
              <dd className={styles.metaValue}>
                <EditableField
                  value={job[field] as string}
                  onChange={(v) => onChange(field, v)}
                  placeholder={`Enter ${label.toLowerCase()}`}
                  label={label}
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
