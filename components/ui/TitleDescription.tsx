"use client";

import React from "react";
import styles from "./TitleDescription.module.css";

interface TitleDescriptionProps {
  title: string;
  description?: string;
  className?: string;
  count?: number;
}

const TitleDescription: React.FC<TitleDescriptionProps> = ({
  title,
  description,
  className = "",
  count,
}) => {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {count !== undefined && <span className={styles.count}>({count})</span>}
      </div>
      {description && <p>{description}</p>}
    </div>
  );
};

export default TitleDescription;
