// components/calendar/BookingBlock.tsx
"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { format, differenceInMinutes } from "date-fns";
import styles from "./BookingBlock.module.css";

interface Booking {
  id: string;
  bayId: string;
  startTime: Date;
  endTime: Date;
  title: string;
  customer: string;
  service: string;
  color: string;
  status: "confirmed" | "pending" | "cancelled";
  price: number;
}

interface BookingBlockProps {
  booking: Booking;
  onUpdate: (id: string, updates: Partial<Booking>) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

export default function BookingBlock({
  booking,
  onUpdate,
  onDelete,
  isDragging = false,
}: BookingBlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useDraggable({
      id: booking.id,
    });

  const duration = differenceInMinutes(booking.endTime, booking.startTime);
  const height = Math.max((duration / 60) * 80, 40); // 80px per hour, minimum 40px

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(true);
  }, []);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(`Delete booking for ${booking.customer}?`)) {
        onDelete(booking.id);
      }
    },
    [booking.customer, booking.id, onDelete]
  );

  const handleStatusChange = useCallback(
    (status: Booking["status"]) => {
      onUpdate(booking.id, { status });
      setShowDetails(false);
    },
    [booking.id, onUpdate]
  );

  const getStatusColor = (status: Booking["status"]) => {
    switch (status) {
      case "confirmed":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transition,
      }
    : {};

  return (
    <>
      <motion.div
        ref={setNodeRef}
        style={{
          ...style,
          height: `${height}px`,
          backgroundColor: booking.color,
          opacity: isDragging ? 0.8 : 1,
        }}
        className={`${styles.bookingBlock} ${styles[booking.status]} ${
          isDragging ? styles.dragging : ""
        }`}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleEdit}
        {...attributes}
        {...listeners}
      >
        {/* Status indicator */}
        <div
          className={styles.statusIndicator}
          style={{ backgroundColor: getStatusColor(booking.status) }}
        />

        {/* Booking content */}
        <div className={styles.bookingContent}>
          <div className={styles.bookingHeader}>
            <span className={styles.bookingTime}>
              {format(booking.startTime, "HH:mm")} -{" "}
              {format(booking.endTime, "HH:mm")}
            </span>
            <span className={styles.bookingPrice}>${booking.price}</span>
          </div>

          <div className={styles.bookingTitle}>{booking.title}</div>

          <div className={styles.bookingCustomer}>{booking.customer}</div>

          {duration >= 60 && (
            <div className={styles.bookingService}>{booking.service}</div>
          )}
        </div>

        {/* Hover actions */}
        <motion.div
          className={styles.bookingActions}
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            className={styles.actionButton}
            onClick={handleEdit}
            title="Edit booking"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            className={styles.actionButton}
            onClick={handleDelete}
            title="Delete booking"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </motion.div>

        {/* Resize handles */}
        <div className={styles.resizeHandle} />
      </motion.div>

      {/* Booking details modal */}
      {showDetails && (
        <motion.div
          className={styles.detailsOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowDetails(false)}
        >
          <motion.div
            className={styles.detailsModal}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.detailsHeader}>
              <h3>{booking.title}</h3>
              <button
                className={styles.closeButton}
                onClick={() => setShowDetails(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.detailsContent}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Customer:</span>
                <span className={styles.detailValue}>{booking.customer}</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Service:</span>
                <span className={styles.detailValue}>{booking.service}</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Time:</span>
                <span className={styles.detailValue}>
                  {format(booking.startTime, "MMM d, yyyy")} •{" "}
                  {format(booking.startTime, "HH:mm")} -{" "}
                  {format(booking.endTime, "HH:mm")}
                </span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Duration:</span>
                <span className={styles.detailValue}>{duration} minutes</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Price:</span>
                <span className={styles.detailValue}>${booking.price}</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status:</span>
                <div className={styles.statusButtons}>
                  {(["confirmed", "pending", "cancelled"] as const).map(
                    (status) => (
                      <button
                        key={status}
                        className={`${styles.statusButton} ${
                          booking.status === status ? styles.active : ""
                        }`}
                        style={{
                          backgroundColor:
                            booking.status === status
                              ? getStatusColor(status)
                              : "transparent",
                          borderColor: getStatusColor(status),
                          color:
                            booking.status === status
                              ? "white"
                              : getStatusColor(status),
                        }}
                        onClick={() => handleStatusChange(status)}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className={styles.detailsActions}>
              <button className={styles.deleteButton} onClick={handleDelete}>
                Delete Booking
              </button>
              <button
                className={styles.saveButton}
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
