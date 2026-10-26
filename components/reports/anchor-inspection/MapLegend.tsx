"use client";
// components/reports/anchor-inspection/MapLegend.tsx
//
// Legend over the zone editor's map: one row per legend group, with the
// same pastel pill and icon the report uses for it.

import React from "react";
import styles from "./MapLegend.module.css";
import {
  anchorGroupKey,
  anchorIconName,
  anchorTypeSentence,
  buildLegendGroups,
  pastelFor,
  type AnchorPoint,
  type AnchorType,
} from "@/lib/reports/anchor.types";

interface MapLegendProps {
  types: AnchorType[];
  anchors: AnchorPoint[];
  /** Report-wide group order, so colours match the report. */
  groupOrder: string[];
}

export default function MapLegend({ types, anchors, groupOrder }: MapLegendProps) {
  const groups = buildLegendGroups(types, anchors);
  if (groups.length === 0) return null;
  return (
    <div className={styles.legend}>
      {groups.map((g) => {
        const first = anchors.find((a) => anchorGroupKey(a) === g.key)!;
        const p = pastelFor(groupOrder, g.key);
        return (
          <div key={g.key} className={styles.item}>
            <span className={styles.pill} style={{ background: p.bg, color: p.fg }}>
              A
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/reports/anchor/icons/${anchorIconName(first)}.svg`} alt="" width={16} height={16} />
            <span className={styles.label}>{anchorTypeSentence(first)}</span>
            <span className={styles.count}>{g.count}</span>
          </div>
        );
      })}
    </div>
  );
}
