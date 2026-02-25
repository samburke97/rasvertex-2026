// components/calendar/MonthView.tsx
"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import BookingBlock from "./BookingBlock";
import styles from "./MonthView.module.css";

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

interface MonthViewProps {
  currentDate: Date;
  bookings: Booking[];
  onDayClick: (date: Date) => void;
  onCreateBooking: (date: Date) => void;
  selectedDate: Date | null;
}

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function MonthView({
  currentDate,
  bookings,
  onDayClick,
  onCreateBooking,
  selectedDate,
}: MonthViewProps) {
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start on Monday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(new Date(day));
      day = addDays(day, 1);
    }

    return days;
  }, [currentDate]);

  // Get bookings for a specific day
  const getBookingsForDay = (date: Date) => {
    return bookings.filter((booking) => isSameDay(booking.startTime, date));
  };

  return (
    <div className={styles.monthView}>
      {/* Week Headers */}
      <div className={styles.weekHeaders}>
        {WEEKDAYS.map((day) => (
          <div key={day} className={styles.weekHeader}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          const dayBookings = getBookingsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <DayCell
              key={day.toISOString()}
              date={day}
              bookings={dayBookings}
              isCurrentMonth={isCurrentMonth}
              isSelected={isSelected}
              isToday={isTodayDate}
              onClick={() => onDayClick(day)}
              onCreateBooking={() => onCreateBooking(day)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface DayCellProps {
  date: Date;
  bookings: Booking[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
  onCreateBooking: () => void;
}

function DayCell({
  date,
  bookings,
  isCurrentMonth,
  isSelected,
  isToday,
  onClick,
  onCreateBooking,
}: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${format(date, "yyyy-MM-dd")}`,
    data: { date },
  });

  return (
    <motion.div
      ref={setNodeRef}
      className={`${styles.dayCell} ${
        !isCurrentMonth ? styles.otherMonth : ""
      } ${isSelected ? styles.selected : ""} ${
        isToday ? styles.today : ""
      } ${isOver ? styles.dragOver : ""}`}
      onClick={onClick}
      onDoubleClick={onCreateBooking}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Day Number */}
      <div className={styles.dayNumber}>{format(date, "d")}</div>

      {/* Bookings for this day */}
      <div className={styles.dayBookings}>
        {bookings.slice(0, 3).map((booking, index) => (
          <motion.div
            key={booking.id}
            className={styles.dayBookingItem}
            style={{
              backgroundColor: booking.color,
              zIndex: bookings.length - index,
            }}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            layout
          >
            <span className={styles.bookingTime}>
              {format(booking.startTime, "HH:mm")}
            </span>
            <span className={styles.bookingTitle}>{booking.title}</span>
          </motion.div>
        ))}

        {/* Show more indicator */}
        {bookings.length > 3 && (
          <div className={styles.moreBookings}>+{bookings.length - 3} more</div>
        )}
      </div>

      {/* Add booking button (shows on hover) */}
      <motion.button
        className={styles.addBookingButton}
        onClick={(e) => {
          e.stopPropagation();
          onCreateBooking();
        }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" />
        </svg>
      </motion.button>

      {/* Drag over indicator */}
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
