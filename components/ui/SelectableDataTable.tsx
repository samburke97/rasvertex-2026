"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import IconButton from "@/components/ui/IconButton";
import styles from "./SelectableDataTable.module.css";
import Pagination from "./Pagination";

interface SelectableItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  [key: string]: any;
}

interface ColumnConfig {
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
}

interface SelectableDataTableProps<T extends SelectableItem> {
  items: T[];
  selected: T[];
  onAdd: (item: T) => Promise<void> | void;
  onRemove: (itemId: string) => Promise<void> | void;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode | string;
  nameColumnConfig?: ColumnConfig;
  statusColumnConfig?: ColumnConfig;
  actionColumnConfig?: ColumnConfig;
  itemType?: "group" | "tag" | "sport" | "facility";
  className?: string;
  itemsPerPage?: number;
  initialPage?: number;
}

export default function SelectableDataTable<T extends SelectableItem>({
  items,
  selected,
  onAdd,
  onRemove,
  isLoading = false,
  emptyMessage = "No items found.",
  nameColumnConfig = { header: "Name", align: "left" },
  statusColumnConfig = { header: "Status", align: "center", width: "100px" },
  actionColumnConfig = { header: "Edit", align: "right", width: "80px" },
  itemType = "group",
  className = "",
  itemsPerPage = 8,
  initialPage = 1,
}: SelectableDataTableProps<T>) {
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Helper function to check if an item is selected
  const isSelected = (id: string) => selected.some((item) => item.id === id);

  // Sort items to show selected/added items first
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aSelected = isSelected(a.id);
      const bSelected = isSelected(b.id);

      if (aSelected && !bSelected) return -1; // a is selected, b is not -> a comes first
      if (!aSelected && bSelected) return 1; // a is not selected, b is -> b comes first

      // Both items have the same selection status, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [items, selected]);

  // Calculate total pages
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedItems.length / itemsPerPage)),
    [sortedItems.length, itemsPerPage]
  );

  // Reset to first page if data changes significantly
  React.useEffect(() => {
    setCurrentPage(1);
  }, [items.length, selected.length]);

  // Get current page data
  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  const isItemLoading = (id: string) => loadingItems[id] === true;

  const getIconPath = (type: string) => {
    switch (type) {
      case "group":
        return "/icons/utility-outline/group.svg";
      case "facility":
        return "/icons/utility-outline/add-image.svg";
      case "sport":
        return "/icons/utility-outline/add-image.svg";
      default:
        return "/icons/utility-outline/add-image.svg";
    }
  };

  const handleAdd = async (item: T) => {
    try {
      setLoadingItems((prev) => ({ ...prev, [item.id]: true }));
      await onAdd(item);
    } finally {
      setLoadingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleRemove = async (id: string) => {
    try {
      setLoadingItems((prev) => ({ ...prev, [id]: true }));
      await onRemove(id);
    } finally {
      setLoadingItems((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading data...</p>
      </div>
    );
  }

  if (items.length === 0) {
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

  return (
    <div className={styles.tableWrapper}>
      <div className={`${styles.tableContainer} ${className}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th
                className={styles.tableHeader}
                style={{
                  width: nameColumnConfig.width,
                  textAlign: nameColumnConfig.align || "left",
                }}
              >
                {nameColumnConfig.header}
              </th>
              <th
                className={styles.tableHeader}
                style={{
                  width: statusColumnConfig.width,
                  textAlign: statusColumnConfig.align || "center",
                }}
              >
                {statusColumnConfig.header}
              </th>
              <th
                className={styles.tableHeader}
                style={{
                  width: actionColumnConfig.width,
                  textAlign: actionColumnConfig.align || "right",
                }}
              >
                {actionColumnConfig.header}
              </th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item) => {
              const isItemSelected = isSelected(item.id);
              const isProcessing = isItemLoading(item.id);
              const iconPath = getIconPath(itemType);

              return (
                <tr
                  key={item.id}
                  className={isItemSelected ? styles.selectedRow : ""}
                >
                  <td
                    className={styles.tableCell}
                    style={{ textAlign: nameColumnConfig.align || "left" }}
                  >
                    <div className={styles.nameCell}>
                      <div className={styles.iconContainer}>
                        {(itemType === "tag" ||
                          itemType === "sport" ||
                          itemType === "facility") &&
                        item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            width={20}
                            height={20}
                            alt={item.name}
                            className={styles.itemImage}
                            priority={true}
                          />
                        ) : (
                          <Image
                            src={iconPath}
                            width={20}
                            height={20}
                            alt={itemType}
                            priority={true}
                          />
                        )}
                      </div>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td
                    className={styles.tableCell}
                    style={{ textAlign: statusColumnConfig.align || "center" }}
                  >
                    <div
                      className={
                        isItemSelected
                          ? styles.addedStatus
                          : styles.notAddedStatus
                      }
                    >
                      {isItemSelected ? "Added" : "Not Added"}
                    </div>
                  </td>
                  <td
                    className={styles.tableCell}
                    style={{ textAlign: actionColumnConfig.align || "right" }}
                  >
                    {isProcessing ? (
                      <div className={styles.loadingDots}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : isItemSelected ? (
                      <IconButton
                        icon={
                          <Image
                            src="/icons/utility-outline/trash.svg"
                            width={20}
                            height={20}
                            alt="Remove"
                            className={styles.trashIcon}
                            priority={true}
                          />
                        }
                        variant="ghost"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => handleRemove(item.id)}
                        className={styles.actionButton}
                      />
                    ) : (
                      <IconButton
                        icon={
                          <Image
                            src="/icons/utility-outline/plus.svg"
                            width={20}
                            height={20}
                            alt="Add"
                            priority={true}
                          />
                        }
                        variant="ghost"
                        aria-label={`Add ${item.name}`}
                        onClick={() => handleAdd(item)}
                        className={styles.actionButton}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {items.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
