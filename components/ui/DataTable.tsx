"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import styles from "./DataTable.module.css";
import Pagination from "./Pagination";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  isNameColumn?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  keyField: keyof T;
  className?: string;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode | string;
  selectedId?: string | null;
  itemType?: "group" | "tag" | "location" | "sport" | "activity";
  itemsPerPage?: number;
  initialPage?: number;
}

export default function DataTable<
  T extends { id: string; [key: string]: any }
>({
  columns,
  data,
  onRowClick,
  keyField,
  className = "",
  isLoading = false,
  emptyMessage = "No data available",
  selectedId,
  itemType = "group",
  itemsPerPage = 8,
  initialPage = 1,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Calculate total pages
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(data.length / itemsPerPage)),
    [data.length, itemsPerPage]
  );

  // Reset to first page if data changes significantly
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  // Get current page data
  const currentData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  const getIconPath = (type: string) => {
    if (type === "group") {
      return "/icons/utility-outline/group.svg";
    } else if (type === "sport") {
      return "/icons/utility-outline/add-image.svg";
    } else if (type === "activity") {
      return "/icons/utility-outline/activity.svg";
    } else if (type === "tag") {
      return "/icons/utility-outline/add-image.svg";
    } else {
      return;
    }
  };

  // Function to render a cell with the name cell styling for the first column
  const renderCell = (row: T, column: Column<T>, rowId: string) => {
    if ((itemType === "location" || itemType === "activity") && column.render) {
      return column.render(row);
    }

    // For first column or name column
    if (column.isNameColumn || columns.indexOf(column) === 0) {
      const iconPath = getIconPath(itemType);
      const name = (row as any)[column.key];
      const imageUrl = (row as any).imageUrl;

      if (itemType === "location" || itemType === "activity") {
        return name;
      }

      return (
        <div className={styles.nameCell}>
          <div className={styles.iconContainer}>
            {(itemType === "tag" || itemType === "sport") && imageUrl ? (
              <Image
                src={imageUrl}
                width={20}
                height={20}
                alt={String(name)}
                className={styles.itemImage}
                priority={true}
              />
            ) : iconPath ? (
              <Image
                src={iconPath}
                width={20}
                height={20}
                alt={itemType}
                priority={true}
              />
            ) : null}
          </div>
          <span>{column.render ? column.render(row) : name}</span>
        </div>
      );
    }

    // For other columns, use the standard rendering
    return column.render ? column.render(row) : (row as any)[column.key];
  };

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
        {typeof emptyMessage === "string" ? (
          <p>{emptyMessage}</p>
        ) : (
          emptyMessage
        )}
      </div>
    );
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`${onRowClick ? styles.clickableRow : ""} ${
                    isSelected ? styles.selected : ""
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={`${rowId}-${column.key}`}
                      className={styles.tableCell}
                      style={{ textAlign: column.align || "left" }}
                    >
                      {renderCell(row, column, rowId)}
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
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
