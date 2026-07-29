"use client";

import React from "react";
import styles from "./CountBadge.module.css";

export type CountBadgeVariant =
  | "count"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

interface CountBadgeProps {
  count?: number;
  label?: React.ReactNode;
  variant?: CountBadgeVariant;
  className?: string;
}

const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  label,
  variant = "count",
  className = "",
}) => {
  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${className}`}
    >
      {label ?? count}
    </span>
  );
};

export default CountBadge;
