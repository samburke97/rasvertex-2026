"use client";
// The header every report builder uses: back, title and subtitle, optional
// counts, an optional centre (the proposal's steps), the draft's save
// status, then the actions. Actions use HeaderButton: one primary (black),
// the rest quiet.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./BuilderChrome.module.css";
import type { SaveStatus } from "./useDraftAutosave";

const STATUS: Record<Exclude<SaveStatus, "idle">, [string, string]> = {
  saving: ["Saving…", "#b8860b"],
  saved: ["Saved", "#3f8f68"],
  error: ["Save failed, retrying", "#a83a3a"],
  "too-large": ["Too many photos to save", "#a83a3a"],
};

interface Props {
  onBack: () => void;
  title: string;
  subtitle?: string;
  /** Small counts beside the title ("12 photos"). */
  badges?: (string | false | null | undefined)[];
  centre?: ReactNode;
  /** The draft's autosave state; a string shows as-is (e.g. "Importing photos…"). */
  status?: SaveStatus | { text: string; busy?: boolean };
  children?: ReactNode;
}

export default function BuilderHeader({ onBack, title, subtitle, badges, centre, status, children }: Props) {
  const s =
    status == null || status === "idle"
      ? null
      : typeof status === "string"
        ? STATUS[status]
        : ([status.text, status.busy ? "#b8860b" : "#3f8f68"] as [string, string]);
  return (
    <header className={styles.header}>
      <button className={styles.back} onClick={onBack} aria-label="Back to report types">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </button>
      <div className={styles.titleBlock}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {badges && (
        <div className={styles.meta}>
          {badges.filter(Boolean).map((b) => (
            <span key={b as string} className={styles.badge}>
              {b}
            </span>
          ))}
        </div>
      )}
      {centre ? <div className={styles.centre}>{centre}</div> : <div className={styles.spacer} />}
      <div className={styles.headerRight}>
        {s && (
          <span className={styles.status}>
            <span className={styles.statusDot} style={{ background: s[1] }} />
            {s[0]}
          </span>
        )}
        {children}
      </div>
    </header>
  );
}

export function HeaderButton({ primary, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button {...rest} className={`${primary ? styles.primary : styles.ghost} ${className ?? ""}`} />;
}
