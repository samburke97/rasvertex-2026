"use client";
// components/reports/condition/sections/SummarySection.tsx
//
// Paginated summary — like ScheduleSection:
// - First page has the topBar + body content + footer
// - If the body content is taller than what fits on one A4 page,
//   additional blank continuation pages with footers are auto-added
//   so the printed PDF always has a footer on the last page.

import React, { useRef, useState, useEffect } from "react";
import styles from "./SummarySection.module.css";
import RichTextEditor from "../../shared/RichTextEditor";

interface SummarySectionProps {
  comments: string;
  recommendations: string;
  onCommentsChange: (value: string) => void;
  onRecommendationsChange: (value: string) => void;
}

const ASSOCIATIONS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

// A4 at 96dpi = 1123px
// First page usable body height = 1123 - topBar(120) - bodyPadding(72) - footer(100) = 831px
// Each additional page = 1123 - bodyPadding(72) - footer(100) = 951px
const PAGE_H = 1123;
const FIRST_PAGE_BODY_H = 831;
const CONT_PAGE_BODY_H = 951;

function SummaryFooter() {
  return (
    <div className={styles.footer}>
      {ASSOCIATIONS.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={a.alt} src={a.src} alt={a.alt} className={styles.assocLogo} />
      ))}
    </div>
  );
}

export default function SummarySection({
  comments,
  recommendations,
  onCommentsChange,
  onRecommendationsChange,
}: SummarySectionProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // How many extra (blank + footer) continuation pages are needed
  const [extraPages, setExtraPages] = useState(0);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const measure = () => {
      const bodyH = el.scrollHeight;
      if (bodyH <= FIRST_PAGE_BODY_H) {
        setExtraPages(0);
      } else {
        const overflow = bodyH - FIRST_PAGE_BODY_H;
        setExtraPages(Math.ceil(overflow / CONT_PAGE_BODY_H));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [comments, recommendations]);

  return (
    <>
      {/* ── Page 1 — topBar + body + footer ── */}
      <div className={styles.page}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Summary</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/link_blue.png"
            alt="rasvertex.com.au"
            className={styles.topBarLink}
          />
        </div>

        {/* body has no max-height — grows freely; overflow measured via scrollHeight */}
        <div className={styles.body} ref={bodyRef}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Comments:</div>
            <div className={styles.sectionText}>
              <RichTextEditor
                value={comments}
                onChange={onCommentsChange}
                label="Comments"
                placeholder="Enter comments about the building condition…"
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Recommendations:</div>
            <div className={styles.sectionText}>
              <RichTextEditor
                value={recommendations}
                onChange={onRecommendationsChange}
                label="Recommendations"
                placeholder="Enter recommended works…"
              />
            </div>
          </div>
        </div>

        <SummaryFooter />
      </div>

      {/* ── Continuation pages — footer only, content flows from CSS page break ── */}
      {Array.from({ length: extraPages }).map((_, i) => (
        <div key={i} className={`${styles.page} ${styles.continuationPage}`}>
          <div className={styles.continuationBody} />
          <SummaryFooter />
        </div>
      ))}
    </>
  );
}
