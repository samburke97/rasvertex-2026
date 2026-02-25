import React, { ButtonHTMLAttributes } from "react";
import styles from "./IconButton.module.css";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  dashed?: boolean;
  isImage?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = "primary",
  size = "md",
  className = "",
  dashed = false,
  isImage = false,
  ...props
}) => {
  const variantClass = styles[variant] || "";
  const sizeClass = styles[size] || "";
  const borderClass = dashed ? styles.dashed : "";
  const imageClass = isImage ? styles.imageContainer : "";

  return (
    <button
      type="button"
      className={`${styles.iconButton} ${variantClass} ${sizeClass} ${borderClass} ${imageClass} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};

export default IconButton;
