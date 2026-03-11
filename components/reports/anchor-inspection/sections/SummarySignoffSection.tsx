"use client";
// components/reports/anchor-inspection/sections/SummarySignoffSection.tsx

import React from "react";
import styles from "./SummarySignoffSection.module.css";
import { ASSOCIATIONS } from "@/lib/reports/constants";

function SignoffFooter() {
  return (
    <div className={styles.footer}>
      {ASSOCIATIONS.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={a.alt} src={a.src} alt={a.alt} className={styles.assocLogo} />
      ))}
    </div>
  );
}

export default function SummarySignoffSection() {
  return (
    <div className={styles.page}>
      {/* ── Top bar — identical chrome to all other pages ── */}
      <div className={styles.topBar}>
        <h1 className={styles.title}>Summary</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/reports/link_blue.png"
          alt="rasvertex.com.au"
          className={styles.topBarLink}
        />
      </div>

      {/* ── Body text ── */}
      <div className={styles.body}>
        <p className={styles.para}>
          Hydraulic load testing equipment holds valid calibration and service
          certification.
        </p>
        <p className={styles.para}>
          Height safety systems are for the use of competent persons only. For
          limitations and conditions, users must refer to the installer&apos;s
          user manual.
        </p>
        <p className={styles.para}>
          All height safety systems require annual recertification of hardware
          items and semiannual recertification of synthetic material equipment,
          e.g. harnesses and impact absorbers, as specified in the above
          standards.
        </p>
        <p className={styles.para}>
          Please note that RAS-VERTEX attaches coloured test tags to all anchor
          points identifying the type and intended use of each anchor point.
        </p>

        {/* ── Signoff ── */}
        <div className={styles.signoff}>
          <p className={styles.sincerely}>Sincerely,</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/signature.png"
            alt="Phil Clark signature"
            className={styles.signature}
          />
          <p className={styles.sigName}>Phil Clark</p>
          <p className={styles.sigTitle}>Director</p>
        </div>
      </div>

      <SignoffFooter />
    </div>
  );
}
