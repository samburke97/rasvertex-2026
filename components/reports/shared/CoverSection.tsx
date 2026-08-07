"use client";
// components/reports/shared/CoverSection.tsx
//
// Single cover page component used by all reports that have a cover page.
// Replaces condition/sections/CoverSection.tsx and anchor-inspection/sections/AnchorCoverSection.tsx
//
// The hero background is a fixed app asset (no per-report upload) — see
// lib/reports/condition.print.ts for the matching PDF-side render.
//
// Usage:
//   <CoverSection
//     reportType={job.reportType}
//     metaRows={[{ label: "Prepared For", value: job.preparedFor, onChange: (v) => ... }, ...]}
//     intro={<RichTextEditor ... />}   ← optional; omit for plain text reports
//   />

import React from "react";
import styles from "./CoverSection.module.css";
import { ASSOCIATIONS } from "@/lib/reports/constants";

export interface MetaRow {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

interface CoverSectionProps {
  reportType: string;
  onReportTypeChange: (v: string) => void;
  metaRows: MetaRow[];
  /** Optional slot for the intro area — pass RichTextEditor or EditableField */
  intro?: React.ReactNode;
}

export default function CoverSection({
  reportType,
  onReportTypeChange,
  metaRows,
  intro,
}: CoverSectionProps) {
  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroNavy} />
        <div
          className={styles.heroCoverPhoto}
          style={{ backgroundImage: "url(/images/backgrounds/condition-bg.jpeg)" }}
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroLogo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/ras-logo.png"
            alt="RAS Vertex Maintenance Solutions"
            className={styles.heroLogoImg}
          />
        </div>
        <div className={styles.heroWeb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/link_white.png"
            alt="rasvertex.com.au"
            className={styles.heroWebImg}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className={styles.titleGroup}>
          <div className={styles.reportTitle}>
            <InlineEdit
              value={reportType}
              onChange={onReportTypeChange}
              placeholder="Report Title"
            />
          </div>
          {intro && <div className={styles.intro}>{intro}</div>}
        </div>

        <div className={styles.metaWrap}>
          <table className={styles.meta}>
            <tbody>
              {metaRows.map(({ label, value, onChange, placeholder }) => (
                <tr key={label} className={styles.metaRow}>
                  <td className={styles.metaLabel}>{label}:</td>
                  <td className={styles.metaValue}>
                    <InlineEdit
                      value={value}
                      onChange={onChange}
                      placeholder={
                        placeholder ?? `Enter ${label.toLowerCase()}`
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        {ASSOCIATIONS.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={a.alt}
            src={a.src}
            alt={a.alt}
            className={styles.assocLogo}
          />
        ))}
      </div>
    </div>
  );
}

// ── Inline editable field (simple version, no external dep needed here) ──────

function InlineEdit({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={styles.inlineInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={value ? styles.inlineDisplay : styles.inlinePlaceholder}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}
