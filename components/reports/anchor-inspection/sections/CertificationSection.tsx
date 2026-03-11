"use client";
// components/reports/anchor-inspection/sections/CertificationSection.tsx

import React from "react";
import styles from "./CertificationSection.module.css";
import EditableField from "../../shared/EditableField";
import { ASSOCIATIONS } from "@/lib/reports/constants";
import {
  ANCHOR_TYPE_LABELS,
  type AnchorReportJob,
  type Zone,
} from "@/lib/reports/anchor.types";

interface CertificationSectionProps {
  job: AnchorReportJob;
  zones: Zone[];
  onUpdate: (field: keyof AnchorReportJob, value: string | null) => void;
}

// Aggregate anchor types across all zones → one row per type
function buildAnchorRows(zones: Zone[]) {
  const map = new Map<
    string,
    { label: string; qty: number; rating: string; anyFail: boolean }
  >();
  for (const zone of zones) {
    for (const anchor of zone.anchors) {
      const existing = map.get(anchor.type);
      if (existing) {
        existing.qty += 1;
        if (anchor.result === "FAILED") existing.anyFail = true;
      } else {
        map.set(anchor.type, {
          label: ANCHOR_TYPE_LABELS[anchor.type],
          qty: 1,
          rating: "15kn",
          anyFail: anchor.result === "FAILED",
        });
      }
    }
  }
  return [...map.values()];
}

function CertFooter() {
  return (
    <div className={styles.footer}>
      {ASSOCIATIONS.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={a.alt} src={a.src} alt={a.alt} className={styles.assocLogo} />
      ))}
    </div>
  );
}

export default function CertificationSection({
  job,
  zones,
  onUpdate,
}: CertificationSectionProps) {
  const anchorRows = buildAnchorRows(zones);

  return (
    <div className={styles.page}>
      {/* ── Top bar — same chrome as ZoneSummarySection ── */}
      <div className={styles.topBar}>
        <h1 className={styles.title}>Certification</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/reports/link_blue.png"
          alt="rasvertex.com.au"
          className={styles.topBarLink}
        />
      </div>

      <div className={styles.body}>
        {/* ── Cert heading + number ── */}
        <div className={styles.certHeading}>
          <span className={styles.certTitle}>
            Certification of Test and Examination
          </span>
          <span className={styles.certNum}>
            #
            <EditableField
              value={job.certNumber}
              onChange={(v) => onUpdate("certNumber", v)}
              placeholder="00000"
              label="Certificate Number"
            />
          </span>
        </div>

        {/* ── Details table — same bordered style as the PDF ── */}
        <table className={styles.detailsTable}>
          <tbody>
            {[
              {
                label: "Attention:",
                field: "preparedFor" as keyof AnchorReportJob,
                placeholder: "Contact name",
              },
              {
                label: "Building Name:",
                field: "buildingName" as keyof AnchorReportJob,
                placeholder: "Building name",
              },
              {
                label: "Building Address:",
                field: "address" as keyof AnchorReportJob,
                placeholder: "Street address",
              },
              {
                label: "Inspection Date:",
                field: "inspectionDate" as keyof AnchorReportJob,
                placeholder: "e.g. 5th March 2026",
              },
              {
                label: "Next Inspection Date:",
                field: "nextInspectionDate" as keyof AnchorReportJob,
                placeholder: "e.g. 5th March 2027",
              },
              {
                label: "Authorised By:",
                field: "authorisedBy" as keyof AnchorReportJob,
                placeholder: "Inspector name",
              },
            ].map(({ label, field, placeholder }) => (
              <tr key={field}>
                <td className={styles.dtLabel}>{label}</td>
                <td className={styles.dtValue}>
                  <EditableField
                    value={(job[field] as string) ?? ""}
                    onChange={(v) => onUpdate(field, v)}
                    placeholder={placeholder}
                    label={label.replace(":", "")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Standards statement ── */}
        <div className={styles.standardsBlock}>
          <p className={styles.standardsIntro}>
            RAS-VERTEX have completed a height safety system inspection and
            applied hydraulic load testing to the required components as
            specified by:
          </p>
          <ul className={styles.standardsList}>
            <li>
              AS/NZS 4488.2:1997 Industrial rope access systems: Selection, use
              and maintenance
            </li>
            <li>
              AS/NZS 1891.4:2009 Industrial fall-arrest systems and devices:
              Selection, use and maintenance
            </li>
            <li>
              AS/NZS 1891.1:2007 Industrial fall-arrest systems and devices:
              Harnesses and equipment.
            </li>
          </ul>
        </div>

        {/* ── Anchor type summary table ── */}
        {anchorRows.length > 0 && (
          <table className={styles.anchorTable}>
            <thead>
              <tr>
                <th className={styles.atHead}>Anchor Type</th>
                <th className={styles.atHead}>QTY</th>
                <th className={styles.atHead}>Rating</th>
                <th className={styles.atHead}>Pass Or Fail</th>
              </tr>
            </thead>
            <tbody>
              {anchorRows.map((row, i) => (
                <tr key={i} className={styles.atRow}>
                  <td className={styles.atCell}>{row.label}</td>
                  <td className={styles.atCell}>{row.qty}</td>
                  <td className={styles.atCell}>{row.rating}</td>
                  <td
                    className={`${styles.atCell} ${
                      row.anyFail ? styles.atFail : styles.atPass
                    }`}
                  >
                    {row.anyFail ? "Fail" : "Pass"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CertFooter />
    </div>
  );
}
