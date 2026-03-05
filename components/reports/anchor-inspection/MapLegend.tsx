"use client";
// components/reports/anchor-inspection/MapLegend.tsx

import React from "react";
import styles from "./MapLegend.module.css";
import {
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_LABELS,
  type AnchorPoint,
  type AnchorType,
} from "@/lib/reports/anchor.types";

interface MapLegendProps {
  types: AnchorType[];
  anchors: AnchorPoint[];
}

export default function MapLegend({ types, anchors }: MapLegendProps) {
  return (
    <div className={styles.legend}>
      {types.map((type) => {
        const count = anchors.filter((a) => a.type === type).length;
        const passed = anchors.filter(
          (a) => a.type === type && a.result === "PASSED",
        ).length;
        return (
          <div key={type} className={styles.item}>
            <span
              className={styles.dot}
              style={{ background: ANCHOR_TYPE_COLOURS[type] }}
            />
            <span className={styles.label}>{ANCHOR_TYPE_LABELS[type]}</span>
            <span className={styles.count}>
              {passed}/{count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
