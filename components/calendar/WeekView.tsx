// components/calendar/WeekView.tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  startOfDay,
  differenceInMinutes,
  isToday,
} from "date-fns";
import BookingBlock from "./BookingBlock";
import styles from "./WeekView.module.css";

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

interface WeekViewProps {
  currentDate: Date;
  bookings: Booking[];
  onCreateBooking: (date: Date, timeSlot?: string) => void;
  onDayClick: (date: Date) => void;
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

export default function WeekView({
  currentDate,
  bookings,
  onCreateBooking,
  onDayClick,
}: WeekViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date;
    bayId: string;
    time: string;
  } | null>(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  // Generate week dates starting from Monday
  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Get bookings for a specific day
  const getBookingsForDay = useCallback(
    (date: Date) => {
      return bookings.filter((booking) => isSameDay(booking.startTime, date));
    },
    [bookings]
  );

  // Handle time slot click
  const handleSlotClick = useCallback(
    (date: Date, bayId: string, timeSlot: string) => {
      setSelectedSlot({ date, bayId, time: timeSlot });
      setIsCreatingBooking(true);
    },
    []
  );

  // Handle creating booking
  const handleCreateBooking = useCallback(
    (duration: number = 60) => {
      if (!selectedSlot) return;

      const [hours, minutes] = selectedSlot.time.split(":").map(Number);
      const bookingDate = new Date(selectedSlot.date);
      bookingDate.setHours(hours, minutes, 0, 0);

      onCreateBooking(bookingDate, selectedSlot.time);
      setIsCreatingBooking(false);
      setSelectedSlot(null);
    },
    [selectedSlot, onCreateBooking]
  );

  // Check if a time slot is available
  const isSlotAvailable = useCallback(
    (date: Date, bayId: string, timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const slotTime = new Date(date);
      slotTime.setHours(hours, minutes, 0, 0);

      const dayBookings = getBookingsForDay(date);
      return !dayBookings.some(
        (booking) =>
          booking.bayId === bayId &&
          booking.startTime <= slotTime &&
          booking.endTime > slotTime
      );
    },
    [getBookingsForDay]
  );

  return (
    <div className={styles.weekView}>
      {/* Week Header */}
      <div className={styles.weekHeader}>
        <h2 className={styles.weekTitle}>
          {format(weekDates[0], "MMM d")} -{" "}
          {format(weekDates[6], "MMM d, yyyy")}
        </h2>
        <div className={styles.weekStats}>
          <span className={styles.statItem}>
            {
              bookings.filter((b) =>
                weekDates.some((date) => isSameDay(b.startTime, date))
              ).length
            }{" "}
            bookings this week
          </span>
        </div>
      </div>

      {/* Week Grid */}
      <div className={styles.weekGrid}>
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

        {/* Day Columns */}
        {weekDates.map((date) => (
          <div key={date.toISOString()} className={styles.dayColumn}>
            {/* Day Header */}
            <div
              className={`${styles.dayHeader} ${isToday(date) ? styles.today : ""}`}
              onClick={() => onDayClick(date)}
            >
              <div className={styles.dayName}>{format(date, "EEE")}</div>
              <div className={styles.dayNumber}>{format(date, "d")}</div>
              <div className={styles.dayBookingCount}>
                {getBookingsForDay(date).length} bookings
              </div>
            </div>

            {/* Bay Grid for this day */}
            <div className={styles.dayBayGrid}>
              {BAYS.filter((bay) => bay.isActive).map((bay) => (
                <div key={bay.id} className={styles.bayLane}>
                  {/* Bay indicator */}
                  <div
                    className={styles.bayIndicator}
                    style={{ backgroundColor: bay.color }}
                    title={bay.name}
                  >
                    {bay.name.split(" ")[1]} {/* Show just "1", "2", etc. */}
                  </div>

                  {/* Time slots for this bay */}
                  <div className={styles.slotsContainer}>
                    {TIME_SLOTS.map((timeStr) => {
                      const isAvailable = isSlotAvailable(
                        date,
                        bay.id,
                        timeStr
                      );

                      return (
                        <WeekTimeSlot
                          key={`${bay.id}-${timeStr}`}
                          date={date}
                          bayId={bay.id}
                          timeSlot={timeStr}
                          isAvailable={isAvailable}
                          onClick={() =>
                            isAvailable &&
                            handleSlotClick(date, bay.id, timeStr)
                          }
                        />
                      );
                    })}

                    {/* Render bookings for this bay/day */}
                    <div className={styles.bookingsContainer}>
                      <AnimatePresence>
                        {getBookingsForDay(date)
                          .filter((booking) => booking.bayId === bay.id)
                          .map((booking) => (
                            <WeekBookingBlock
                              key={booking.id}
                              booking={booking}
                              date={date}
                            />
                          ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              ))}
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
                {format(selectedSlot.date, "EEEE, MMMM d, yyyy")} at{" "}
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

// Individual Time Slot for Week View
interface WeekTimeSlotProps {
  date: Date;
  bayId: string;
  timeSlot: string;
  isAvailable: boolean;
  onClick: () => void;
}

function WeekTimeSlot({
  date,
  bayId,
  timeSlot,
  isAvailable,
  onClick,
}: WeekTimeSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-slot-${bayId}-${format(date, "yyyy-MM-dd")}-${timeSlot}`,
    data: { bayId, timeSlot, date },
  });

  return (
    <motion.div
      ref={setNodeRef}
      className={`${styles.weekTimeSlot} ${
        isAvailable ? styles.available : styles.occupied
      } ${isOver ? styles.dragOver : ""}`}
      onClick={onClick}
      whileHover={isAvailable ? { backgroundColor: "#f0fdf4" } : {}}
    >
      {isAvailable && isOver && (
        <motion.div
          className={styles.dragOverIndicator}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </motion.div>
  );
}

// Booking block for week view
interface WeekBookingBlockProps {
  booking: Booking;
  date: Date;
}

function WeekBookingBlock({ booking, date }: WeekBookingBlockProps) {
  const startMinutes = differenceInMinutes(booking.startTime, startOfDay(date));
  const duration = differenceInMinutes(booking.endTime, booking.startTime);

  const top = (startMinutes / 60) * 40; // 40px per hour in week view
  const height = Math.max((duration / 60) * 40, 20); // Minimum 20px height

  return (
    <motion.div
      className={styles.weekBookingBlock}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: booking.color,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      title={`${booking.title} - ${booking.customer}`}
    >
      <div className={styles.weekBookingContent}>
        <div className={styles.weekBookingTime}>
          {format(booking.startTime, "HH:mm")}
        </div>
        <div className={styles.weekBookingTitle}>{booking.title}</div>
        {duration >= 60 && (
          <div className={styles.weekBookingCustomer}>{booking.customer}</div>
        )}
      </div>
    </motion.div>
  );
}
