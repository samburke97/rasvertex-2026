"use client";

import React, { ReactNode } from "react";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import styles from "./ActionHeader.module.css";

interface ActionHeaderProps {
  primaryAction?: () => Promise<void> | void;
  secondaryAction?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  isProcessing?: boolean;
  processingLabel?: string;
  className?: string;
  variant?: "default" | "edit" | "create";
  type?: "standard" | "back";
  deleteAction?: () => Promise<void> | void;
  backIcon?: ReactNode;
  constrained?: boolean; // New prop to control max-width behavior
}

const ActionHeader: React.FC<ActionHeaderProps> = ({
  primaryAction,
  secondaryAction,
  primaryLabel = "Save",
  secondaryLabel = "Cancel",
  isProcessing = false,
  processingLabel,
  className = "",
  variant = "default",
  type = "standard",
  deleteAction,
  backIcon,
  constrained = true, // Default to true for backward compatibility
}) => {
  const actionProcessingLabel = processingLabel || `${primaryLabel}ing...`;

  // Create a simple back arrow SVG inline
  const BackIconSvg = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 18L9 12L15 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // If type is 'back', show only the back button
  if (type === "back" && secondaryAction) {
    return (
      <header className={`${styles.header} ${className}`}>
        <div
          className={`${styles.headerContent} ${!constrained ? styles.headerContentUnconstrained : ""}`}
        >
          <IconButton
            icon={backIcon || <BackIconSvg />}
            variant="ghost"
            onClick={secondaryAction}
            aria-label="Go back"
          />
          <div className={styles.spacer}></div>
        </div>
      </header>
    );
  }

  return (
    <header className={`${styles.header} ${className}`}>
      <div
        className={`${styles.headerContent} ${!constrained ? styles.headerContentUnconstrained : ""}`}
      >
        {variant === "edit" ? (
          <>
            <IconButton
              icon={backIcon || <BackIconSvg />}
              variant="ghost"
              onClick={secondaryAction}
              aria-label="Go back"
            />
            <div className={styles.actions}>
              {deleteAction && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={deleteAction}
                  disabled={isProcessing}
                >
                  Delete
                </Button>
              )}
              {primaryAction && (
                <Button
                  type="button"
                  onClick={primaryAction}
                  disabled={isProcessing}
                >
                  {isProcessing ? actionProcessingLabel : primaryLabel}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={styles.spacer}></div>
            <div className={styles.actions}>
              {secondaryAction && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={secondaryAction}
                  disabled={isProcessing}
                >
                  {secondaryLabel}
                </Button>
              )}
              {primaryAction && (
                <Button
                  type="button"
                  onClick={primaryAction}
                  disabled={isProcessing}
                >
                  {isProcessing ? actionProcessingLabel : primaryLabel}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default ActionHeader;
