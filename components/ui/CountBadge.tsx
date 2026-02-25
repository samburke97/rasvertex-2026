"use client";

import React from "react";
import styles from "./CountBadge.module.css";

interface CountBadgeProps {
  count: number;
  className?: string;
}

const CountBadge: React.FC<CountBadgeProps> = ({ count, className = "" }) => {
  return <span className={`${styles.badge} ${className}`}>{count}</span>;
};

export default CountBadge;
