"use client";
// components/reports/anchor-inspection/MapLegend.tsx

import React from "react";
import styles from "./MapLegend.module.css";
import {
  buildLegendGroups,
  type AnchorPoint,
  type AnchorType,
  type LegendIconShape,
} from "@/lib/reports/anchor.types";

interface MapLegendProps {
  types: AnchorType[];
  anchors: AnchorPoint[];
}

function LegendIcon({
  shape,
  colour,
}: {
  shape: LegendIconShape;
  colour: string;
}) {
  if (shape === "static-line") {
    return (
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
          stroke={colour}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="1" cy="5" r="1.5" fill={colour} />
        <circle cx="13" cy="5" r="1.5" fill={colour} />
      </svg>
    );
  }
  if (shape === "dot") {
    return <span className={styles.dot} style={{ background: colour }} />;
  }
  return (
    <svg className={styles.shapeIcon} width="14" height="14" viewBox="0 0 14 14">
      {shape === "circle" && <circle cx="7" cy="7" r="5" fill={colour} />}
      {shape === "ring" && (
        <circle
          cx="7"
          cy="7"
          r="4.5"
          fill="none"
          stroke={colour}
          strokeWidth="2.5"
        />
      )}
      {shape === "square" && (
        <rect x="2" y="2" width="10" height="10" rx="1.5" fill={colour} />
      )}
      {shape === "triangle" && (
        <polygon points="7,1.5 13,12.5 1,12.5" fill={colour} />
      )}
      {shape === "diamond" && (
        <polygon points="7,1 13,7 7,13 1,7" fill={colour} />
      )}
    </svg>
  );
}

export default function MapLegend({ types, anchors }: MapLegendProps) {
  const groups = buildLegendGroups(types, anchors);
  return (
    <div className={styles.legend}>
      {groups.map((g) => (
        <div key={g.key} className={styles.item}>
          <span className={styles.iconSlot}>
            <LegendIcon shape={g.icon} colour={g.colour} />
          </span>
          <span className={styles.label}>{g.label}</span>
          <span className={styles.count}>{g.count}</span>
        </div>
      ))}
    </div>
  );
}
