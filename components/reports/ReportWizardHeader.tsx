"use client";

import React from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import styles from "./ReportWizardHeader.module.css";

interface HeaderActionsProps {
  hasPhotos: boolean;
  hasJobNumber: boolean;
  onQuickPrint: () => void;
  onClearAll: () => void;
  onPDFEditor?: () => void;
  onDropPoints?: () => void;
}

const ReportWizardHeader: React.FC<HeaderActionsProps> = ({
  hasPhotos,
  hasJobNumber,
  onQuickPrint,
  onClearAll,
  onPDFEditor,
  onDropPoints,
}) => {
  if (!hasPhotos && !hasJobNumber) return null;

  return (
    <div className={styles.actions}>
      {hasJobNumber && onDropPoints && (
        <Button
          variant="primary-green"
          onClick={onDropPoints}
          icon={
            <Image
              src="/icons/utility-outline/location.svg"
              alt=""
              width={18}
              height={18}
            />
          }
        >
          Drop Points
        </Button>
      )}

      {hasPhotos && (
        <>
          <Button
            variant="secondary"
            onClick={onQuickPrint}
            icon={
              <Image
                src="/icons/utility-outline/export.svg"
                alt=""
                width={18}
                height={18}
              />
            }
          >
            Quick Print
          </Button>

          {onPDFEditor && (
            <Button
              variant="secondary"
              onClick={onPDFEditor}
              icon={
                <Image
                  src="/icons/utility-outline/import.svg"
                  alt=""
                  width={18}
                  height={18}
                />
              }
            >
              PDF Editor
            </Button>
          )}

          <Button
            variant="danger"
            onClick={onClearAll}
            icon={
              <Image
                src="/icons/utility-outline/cross.svg"
                alt=""
                width={18}
                height={18}
              />
            }
          >
            Clear All
          </Button>
        </>
      )}
    </div>
  );
};

export default ReportWizardHeader;
