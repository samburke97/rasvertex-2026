// components/calendar/DayView.tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  format,
  addMinutes,
  isSameDay,
  startOfDay,
  differenceInMinutes,
} from "date-fns";
import BookingBlock from "./BookingBlock";
import TimeSlot from "./TimeSlot";
import styles from "./DayView.module.css";

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

interface DayViewProps {
  currentDate: Date;
  bookings: Booking[];
  onCreateBooking: (date: Date, timeSlot?: string) => void;
}

interface Bay {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

const BAYS: Bay[] = [
  { id: "bay-1", name: "Bay 1", color: "#10b981", isActive: true },
  { id: "bay-2", name: "Bay 2", color: "#3b82f6", isActive: true },
  { id: "bay-3", name: "Bay 3", color: "#8b5cf6", isActive: true },
  { id: "bay-4", name: "Bay 4", color: "#f59e0b", isActive: true },
  { id: "bay-5", name: "Bay 5", color: "#ef4444", isActive: true },
  { id: "bay-6", name: "Bay 6", color: "#06b6d4", isActive: true },
  { id: "bay-7", name: "Bay 7", color: "#84cc16", isActive: true },
];

const TIME_SLOTS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

export default function DayView({
  currentDate,
  bookings,
  onCreateBooking,
}: DayViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<{
    bayId: string;
    time: string;
  } | null>(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  // Get bookings for the current day
  const dayBookings = useMemo(() => {
    return bookings.filter((booking) =>
      isSameDay(booking.startTime, currentDate)
    );
  }, [bookings, currentDate]);

  // Handle time slot click
  const handleSlotClick = useCallback((bayId: string, timeSlot: string) => {
    setSelectedSlot({ bayId, time: timeSlot });
    setIsCreatingBooking(true);
  }, []);

  // Handle creating booking
  const handleCreateBooking = useCallback(
    (duration: number = 60) => {
      if (!selectedSlot) return;

      const [hours, minutes] = selectedSlot.time.split(":").map(Number);
      const bookingDate = new Date(currentDate);
      bookingDate.setHours(hours, minutes, 0, 0);

      onCreateBooking(bookingDate, selectedSlot.time);
      setIsCreatingBooking(false);
      setSelectedSlot(null);
    },
    [selectedSlot, currentDate, onCreateBooking]
  );

  // Check if a time slot is available
  const isSlotAvailable = useCallback(
    (bayId: string, timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const slotTime = new Date(currentDate);
      slotTime.setHours(hours, minutes, 0, 0);

      return !dayBookings.some(
        (booking) =>
          booking.bayId === bayId &&
          booking.startTime <= slotTime &&
          booking.endTime > slotTime
      );
    },
    [dayBookings, currentDate]
  );

  // Get booking for a specific slot
  const getBookingForSlot = useCallback(
    (bayId: string, timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const slotTime = new Date(currentDate);
      slotTime.setHours(hours, minutes, 0, 0);

      return dayBookings.find(
        (booking) =>
          booking.bayId === bayId &&
          booking.startTime <= slotTime &&
          booking.endTime > slotTime
      );
    },
    [dayBookings, currentDate]
  );

  return (
    <div className={styles.dayView}>
      {/* Day Header */}
      <div className={styles.dayHeader}>
        <h2 className={styles.dayTitle}>
          {format(currentDate, "EEEE, MMMM d, yyyy")}
        </h2>
        <div className={styles.dayStats}>
          <span className={styles.statItem}>{dayBookings.length} bookings</span>
          <span className={styles.statItem}>
            {BAYS.filter((b) => b.isActive).length} bays available
          </span>
        </div>
      </div>

      {/* Time Grid */}
      <div className={styles.timeGrid}>
        {/* Time Column */}
        <div className={styles.timeColumn}>
          <div className={styles.timeHeaderCell}></div>
          {TIME_SLOTS.map((time) => (
            <div key={time} className={styles.timeCell}>
              <span className={styles.timeLabel}>{time}</span>
              <span className={styles.timeUnit}>
                {parseInt(time.split(":")[0]) >= 12 ? "PM" : "AM"}
              </span>
            </div>
          ))}
        </div>

        {/* Bay Columns */}
        {BAYS.filter((bay) => bay.isActive).map((bay) => (
          <div key={bay.id} className={styles.bayColumn}>
            {/* Bay Header */}
            <div className={styles.bayHeader}>
              <div
                className={styles.bayIcon}
                style={{ backgroundColor: `${bay.color}20`, color: bay.color }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className={styles.bayName}>{bay.name}</span>
            </div>

            {/* Time Slots Container */}
            <div className={styles.slotsContainer}>
              {TIME_SLOTS.map((timeStr) => {
                const isAvailable = isSlotAvailable(bay.id, timeStr);
                const booking = getBookingForSlot(bay.id, timeStr);

                return (
                  <TimeSlotCell
                    key={`${bay.id}-${timeStr}`}
                    bayId={bay.id}
                    timeSlot={timeStr}
                    isAvailable={isAvailable}
                    booking={booking}
                    onClick={() =>
                      isAvailable && handleSlotClick(bay.id, timeStr)
                    }
                    currentDate={currentDate}
                  />
                );
              })}

              {/* Render bookings as overlays */}
              <div className={styles.bookingsContainer}>
                <AnimatePresence>
                  {dayBookings
                    .filter((booking) => booking.bayId === bay.id)
                    .map((booking) => (
                      <DayBookingBlock
                        key={booking.id}
                        booking={booking}
                        currentDate={currentDate}
                      />
                    ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Booking Modal */}
      <AnimatePresence>
        {isCreatingBooking && selectedSlot && (
          <motion.div
            className={styles.quickBookingOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCreatingBooking(false)}
          >
            <motion.div
              className={styles.quickBookingModal}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Create Booking</h3>
              <p>
                {format(currentDate, "EEEE, MMMM d, yyyy")} at{" "}
                {selectedSlot.time}
              </p>
              <p>Bay: {BAYS.find((b) => b.id === selectedSlot.bayId)?.name}</p>

              <div className={styles.quickBookingActions}>
                <button onClick={() => handleCreateBooking(30)}>
                  30 Minutes
                </button>
                <button onClick={() => handleCreateBooking(60)}>1 Hour</button>
                <button onClick={() => handleCreateBooking(90)}>
                  1.5 Hours
                </button>
                <button onClick={() => handleCreateBooking(120)}>
                  2 Hours
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Individual Time Slot Cell
interface TimeSlotCellProps {
  bayId: string;
  timeSlot: string;
  isAvailable: boolean;
  booking?: Booking;
  onClick: () => void;
  currentDate: Date;
}

function TimeSlotCell({
  bayId,
  timeSlot,
  isAvailable,
  booking,
  onClick,
  currentDate,
}: TimeSlotCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${bayId}-${format(currentDate, "yyyy-MM-dd")}-${timeSlot}`,
    data: { bayId, timeSlot, date: currentDate },
  });

  return (
    <motion.div
      ref={setNodeRef}
      className={`${styles.timeSlotCell} ${
        isAvailable ? styles.available : styles.occupied
      } ${isOver ? styles.dragOver : ""}`}
      onClick={onClick}
      whileHover={isAvailable ? { backgroundColor: "#f0fdf4" } : {}}
      whileTap={isAvailable ? { scale: 0.98 } : {}}
    >
      {isAvailable && (
        <motion.div
          className={styles.availabilityIndicator}
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" />
          </svg>
        </motion.div>
      )}

      {isOver && (
        <motion.div
          className={styles.dragOverIndicator}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        />
      )}
    </motion.div>
  );
}

// Booking block positioned in day view
interface DayBookingBlockProps {
  booking: Booking;
  currentDate: Date;
}

function DayBookingBlock({ booking, currentDate }: DayBookingBlockProps) {
  const startMinutes = differenceInMinutes(
    booking.startTime,
    startOfDay(currentDate)
  );
  const duration = differenceInMinutes(booking.endTime, booking.startTime);

  const top = (startMinutes / 60) * 80; // 80px per hour
  const height = Math.max((duration / 60) * 80, 40); // Minimum 40px height

  return (
    <motion.div
      className={styles.dayBookingBlock}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: booking.color,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className={styles.bookingContent}>
        <div className={styles.bookingTime}>
          {format(booking.startTime, "HH:mm")} -{" "}
          {format(booking.endTime, "HH:mm")}
        </div>
        <div className={styles.bookingTitle}>{booking.title}</div>
        <div className={styles.bookingCustomer}>{booking.customer}</div>
        {duration >= 60 && (
          <div className={styles.bookingService}>{booking.service}</div>
        )}
      </div>
    </motion.div>
  );
}
