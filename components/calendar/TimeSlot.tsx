// components/calendar/TimeSlot.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import styles from "./TimeSlot.module.css";

interface TimeSlotData {
  time: Date;
  bayId: string;
  isAvailable: boolean;
  bookingId?: string;
}

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

interface TimeSlotProps {
  slot: TimeSlotData;
  booking?: Booking;
  isHovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
}

export default function TimeSlot({
  slot,
  booking,
  isHovered,
  onClick,
  onHover,
  onHoverEnd,
}: TimeSlotProps) {
  const dropId = `slot-${slot.bayId}-${format(slot.time, "yyyy-MM-dd")}-${format(slot.time, "HH:mm")}`;

  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled: !slot.isAvailable,
  });

  const isCurrentTime = () => {
    const now = new Date();
    const slotTime = slot.time;
    const timeDiff = Math.abs(now.getTime() - slotTime.getTime());
    return timeDiff < 30 * 60 * 1000; // Within 30 minutes
  };

  const isPastTime = () => {
    const now = new Date();
    return slot.time < now;
  };

  return (
    <motion.div
      ref={setNodeRef}
      className={`${styles.timeSlot} ${
        slot.isAvailable ? styles.available : styles.occupied
      } ${isOver ? styles.dragOver : ""} ${
        isHovered ? styles.hovered : ""
      } ${isCurrentTime() ? styles.currentTime : ""} ${
        isPastTime() ? styles.pastTime : ""
      }`}
      onClick={slot.isAvailable ? onClick : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      whileHover={slot.isAvailable ? { backgroundColor: "#f0fdf4" } : {}}
      whileTap={slot.isAvailable ? { scale: 0.98 } : {}}
      layout
      transition={{
        layout: { duration: 0.2 },
        backgroundColor: { duration: 0.15 },
      }}
    >
      {/* Availability indicator */}
      {slot.isAvailable && (
        <motion.div
          className={styles.availabilityIndicator}
          initial={{ scale: 0 }}
          animate={{ scale: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 7v5l3 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      )}

      {/* Drag over indicator */}
      {isOver && (
        <motion.div
          className={styles.dragOverIndicator}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        />
      )}

      {/* Current time indicator */}
      {isCurrentTime() && (
        <motion.div
          className={styles.currentTimeIndicator}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      )}

      {/* Conflict warning */}
      {!slot.isAvailable && booking && booking.status === "pending" && (
        <div className={styles.conflictWarning}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </motion.div>
  );
}
