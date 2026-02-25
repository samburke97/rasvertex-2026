// components/calendar/BookingCalendar.tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  MouseSensor,
} from "@dnd-kit/core";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import { useCalendar } from "./CalendarContext";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import styles from "./BookingCalendar.module.css";

interface BookingCalendarProps {
  viewMode: "day" | "3day" | "week" | "month";
  currentDate: Date;
  onDateChange: (date: Date) => void;
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

export default function BookingCalendar({
  viewMode,
  currentDate,
  onDateChange,
}: BookingCalendarProps) {
  const { bookings, addBooking, updateBooking, deleteBooking } = useCalendar();
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [zoomLevel, setZoomLevel] = useState<"month" | "week" | "day">("month");

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const booking = bookings.find((b) => b.id === event.active.id);
      setDraggedBooking(booking || null);
    },
    [bookings]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !draggedBooking) {
        setDraggedBooking(null);
        return;
      }

      // Handle dropping on different day cells
      const dropTargetDate = over.data?.current?.date;
      if (dropTargetDate) {
        const duration =
          draggedBooking.endTime.getTime() - draggedBooking.startTime.getTime();
        const newStartTime = new Date(dropTargetDate);
        newStartTime.setHours(
          draggedBooking.startTime.getHours(),
          draggedBooking.startTime.getMinutes()
        );
        const newEndTime = new Date(newStartTime.getTime() + duration);

        updateBooking(draggedBooking.id, {
          ...draggedBooking,
          startTime: newStartTime,
          endTime: newEndTime,
        });
      }

      setDraggedBooking(null);
    },
    [draggedBooking, updateBooking]
  );

  // Handle day cell click for zooming
  const handleDayClick = useCallback(
    (date: Date) => {
      setSelectedDate(date);

      // Zoom logic: month -> week -> day
      if (zoomLevel === "month") {
        setZoomLevel("week");
        onDateChange(date);
      } else if (zoomLevel === "week") {
        setZoomLevel("day");
        onDateChange(date);
      }
    },
    [zoomLevel, onDateChange]
  );

  // Handle zoom out
  const handleZoomOut = useCallback(() => {
    if (zoomLevel === "day") {
      setZoomLevel("week");
    } else if (zoomLevel === "week") {
      setZoomLevel("month");
    }
  }, [zoomLevel]);

  // Handle creating new booking
  const handleCreateBooking = useCallback(
    (date: Date, timeSlot?: string) => {
      const startTime = new Date(date);
      if (timeSlot) {
        const [hours, minutes] = timeSlot.split(":").map(Number);
        startTime.setHours(hours, minutes, 0, 0);
      } else {
        startTime.setHours(9, 0, 0, 0); // Default to 9 AM
      }

      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      const newBooking: Booking = {
        id: `booking-${Date.now()}`,
        bayId: "bay-1", // Default bay
        startTime,
        endTime,
        title: "New Booking",
        customer: "Walk-in Customer",
        service: "Standard Session",
        color: "#10b981",
        status: "pending",
        price: 60,
      };

      addBooking(newBooking);
    },
    [addBooking]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.calendarContainer}>
        {/* Calendar Header with Zoom Controls */}
        <div className={styles.calendarHeader}>
          <div className={styles.zoomControls}>
            <button
              className={styles.zoomButton}
              onClick={handleZoomOut}
              disabled={zoomLevel === "month"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M21 21l-4.35-4.35"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M8 11h6" stroke="currentColor" strokeWidth="2" />
              </svg>
              Zoom Out
            </button>

            <span className={styles.zoomLevel}>
              {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)} View
            </span>

            <button
              className={styles.zoomButton}
              onClick={() => selectedDate && handleDayClick(selectedDate)}
              disabled={zoomLevel === "day"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M21 21l-4.35-4.35"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M11 8v6M8 11h6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              Zoom In
            </button>
          </div>
        </div>

        {/* Calendar Views */}
        <AnimatePresence mode="wait">
          {(viewMode === "month" || zoomLevel === "month") && (
            <motion.div
              key="month"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <MonthView
                currentDate={currentDate}
                bookings={bookings}
                onDayClick={handleDayClick}
                onCreateBooking={handleCreateBooking}
                selectedDate={selectedDate}
              />
            </motion.div>
          )}

          {(viewMode === "week" || zoomLevel === "week") && (
            <motion.div
              key="week"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <WeekView
                currentDate={currentDate}
                bookings={bookings}
                onCreateBooking={handleCreateBooking}
                onDayClick={handleDayClick}
              />
            </motion.div>
          )}

          {(viewMode === "day" || zoomLevel === "day") && (
            <motion.div
              key="day"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <DayView
                currentDate={currentDate}
                bookings={bookings}
                onCreateBooking={handleCreateBooking}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedBooking && (
            <div className={styles.dragOverlay}>
              <div
                className={styles.draggedBooking}
                style={{ backgroundColor: draggedBooking.color }}
              >
                <div className={styles.draggedTitle}>
                  {draggedBooking.title}
                </div>
                <div className={styles.draggedCustomer}>
                  {draggedBooking.customer}
                </div>
                <div className={styles.draggedTime}>
                  {format(draggedBooking.startTime, "HH:mm")} -{" "}
                  {format(draggedBooking.endTime, "HH:mm")}
                </div>
              </div>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
