"use client";

import React, { useState, useMemo } from "react";
import styles from "./DataTable.module.css";
import Pagination from "./Pagination";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  keyField: keyof T;
  className?: string;
  rowClassName?: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode | string;
  selectedId?: string | null;
  itemsPerPage?: number;
  initialPage?: number;
}

export default function DataTable<T>({
  columns,
  data,
  onRowClick,
  keyField,
  className = "",
  rowClassName,
  isLoading = false,
  emptyMessage = "No data available",
  selectedId,
  itemsPerPage = 8,
  initialPage = 1,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(data.length / itemsPerPage)),
    [data.length, itemsPerPage],
  );

  // Reset to first page if the data set changes size (new filter/search).
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const currentData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        {typeof emptyMessage === "string" ? <p>{emptyMessage}</p> : emptyMessage}
      </div>
    );
  }

  return (
    <div className={`${styles.tableWrapper} ${className}`}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={styles.tableHeader}
                  style={{
                    width: column.width,
                    textAlign: column.align || "left",
                  }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.map((row) => {
              const rowId = String(row[keyField]);
              const isSelected = selectedId === rowId;

              return (
                <tr
                  key={rowId}
                  onClick={() => {
                    // A text-selection drag (e.g. copying an email address
                    // out of a cell) still ends in a click on mouseup —
                    // don't treat that as "open this row" too.
                    if (window.getSelection()?.toString()) return;
                    onRowClick && onRowClick(row);
                  }}
                  className={`${onRowClick ? styles.clickableRow : ""} ${
                    isSelected ? styles.selected : ""
                  } ${rowClassName ? rowClassName(row) : ""}`}
                >
                  {columns.map((column) => (
                    <td
                      key={`${rowId}-${column.key}`}
                      className={styles.tableCell}
                      style={{ textAlign: column.align || "left" }}
                    >
                      {column.render
                        ? column.render(row)
                        : String(row[column.key as keyof T] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
