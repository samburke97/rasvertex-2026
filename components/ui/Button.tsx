"use client";

import { ReactNode } from "react";
import Image from "next/image";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "primary-green"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type IconPosition = "left" | "right";

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPath?: string;
  iconPosition?: IconPosition;
  alt?: string;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
  type = "button",
  disabled = false,
  className = "",
  fullWidth = false,
  icon,
  iconPath,
  iconPosition = "left",
  alt,
}: ButtonProps) {
  // Determine what icon to render
  let iconElement = icon;

  // If iconPath is provided but no icon, create an Image component
  if (iconPath && !icon) {
    // Assume SVG if no extension provided
    const iconSrc = iconPath.includes(".") ? iconPath : `${iconPath}.svg`;

    iconElement = (
      <Image
        src={iconSrc}
        alt=""
        width={size === "sm" ? 16 : size === "md" ? 20 : 24}
        height={size === "sm" ? 16 : size === "md" ? 20 : 24}
        className={variant === "danger" ? styles.whiteIcon : ""}
      />
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${styles.button}
        ${styles[variant]}
        ${styles[size]}
        ${iconElement ? styles.withIcon : ""}
        ${iconElement && iconPosition === "left" ? styles.iconRight : ""}
        ${fullWidth ? styles.fullWidth : ""}
        ${className}
      `}
    >
      {iconElement && iconPosition === "left" && (
        <span className={styles.iconContainer}>{iconElement}</span>
      )}
      {children}
      {iconElement && iconPosition === "right" && (
        <span className={styles.iconContainer}>{iconElement}</span>
      )}
    </button>
  );
}
