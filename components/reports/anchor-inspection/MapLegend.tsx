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
        return (
          <div key={type} className={styles.item}>
            {type === "static-line" ? (
              <svg
                className={styles.lineIcon}
                width="14"
                height="10"
                viewBox="0 0 14 10"
              >
                <line
                  x1="1"
                  y1="5"
                  x2="13"
                  y2="5"
                  stroke={ANCHOR_TYPE_COLOURS[type]}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="1" cy="5" r="1.5" fill={ANCHOR_TYPE_COLOURS[type]} />
                <circle cx="13" cy="5" r="1.5" fill={ANCHOR_TYPE_COLOURS[type]} />
              </svg>
            ) : (
              <span
                className={styles.dot}
                style={{ background: ANCHOR_TYPE_COLOURS[type] }}
              />
            )}
            <span className={styles.label}>{ANCHOR_TYPE_LABELS[type]}</span>
            <span className={styles.count}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}
