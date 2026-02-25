"use client";

import React from "react";
import Image from "next/image";
import IconButton from "./IconButton";
import styles from "./Pagination.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  // Don't render pagination if there's only one page
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Create an array of page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];

    // Always include first page
    pageNumbers.push(1);

    // Add ellipsis if needed
    if (currentPage > 3) {
      pageNumbers.push("ellipsis");
    }

    // Add pages around current page
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pageNumbers.push(i);
    }

    // Add ellipsis if needed
    if (currentPage < totalPages - 2) {
      pageNumbers.push("ellipsis");
    }

    // Always include last page unless it's the first page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  return (
    <div className={`${styles.paginationContainer} ${className}`}>
      <IconButton
        icon={
          <Image
            src="/icons/utility-outline/left.svg"
            width={16}
            height={16}
            alt="Previous page"
            priority
          />
        }
        variant="ghost"
        aria-label="Previous page"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className={styles.paginationButton}
      />

      <div className={styles.paginationText}>
        Page {currentPage} / {totalPages}
      </div>

      <IconButton
        icon={
          <Image
            src="/icons/utility-outline/right.svg"
            width={16}
            height={16}
            alt="Next page"
            priority
          />
        }
        variant="ghost"
        aria-label="Next page"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className={styles.paginationButton}
      />
    </div>
  );
}
