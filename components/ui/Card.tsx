"use client";

import React from "react";
import Link from "next/link";
import styles from "./Card.module.css";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Adds hover lift/shadow + pointer cursor for clickable cards. */
  interactive?: boolean;
  onClick?: () => void;
  /** Renders the card as a Next.js Link instead of a div/button. */
  href?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export default function Card({
  children,
  className = "",
  interactive = false,
  onClick,
  href,
  padding = "md",
}: CardProps) {
  const classes = [
    styles.card,
    styles[`padding-${padding}`],
    interactive || href ? styles.interactive : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
