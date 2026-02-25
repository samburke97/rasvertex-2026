// app/(detail)/calendar/[id]/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import BookingCalendar from "@/components/calendar/BookingCalendar";
import { CalendarProvider } from "@/components/calendar/CalendarContext";
import styles from "./page.module.css";

type ViewMode = "day" | "3day" | "week" | "month";

export default function CalendarDetailPage() {
  const params = useParams();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const handlePrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case "day":
        newDate.setDate(newDate.getDate() - 1);
        break;
      case "3day":
        newDate.setDate(newDate.getDate() - 3);
        break;
      case "week":
        newDate.setDate(newDate.getDate() - 7);
        break;
      case "month":
        newDate.setMonth(newDate.getMonth() - 1);
        break;
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleNext = useCallback(() => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case "day":
        newDate.setDate(newDate.getDate() + 1);
        break;
      case "3day":
        newDate.setDate(newDate.getDate() + 3);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "month":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleAddEvent = useCallback(() => {
    console.log("Add new booking");
  }, []);

  const dateRangeText = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });

    switch (viewMode) {
      case "day":
        return formatter.format(currentDate);
      case "week":
      case "3day": {
        const startOfWeek = new Date(currentDate);
        const dayOfWeek = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(
          startOfWeek.getDate() + (viewMode === "week" ? 6 : 2)
        );

        return `${formatter.format(startOfWeek)} - ${formatter.format(endOfWeek)}`;
      }
      case "month":
        return new Intl.DateTimeFormat("en-US", {
          month: "long",
          year: "numeric",
        }).format(currentDate);
      default:
        return "";
    }
  }, [currentDate, viewMode]);

  return (
    <CalendarProvider>
      <div className={styles.pageContainer}>
        <div className={styles.container}>
          {/* Header - Professional booking system style */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 className={styles.title}>Classes</h1>
              <div className={styles.dateNavigation}>
                <IconButton
                  icon={
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M10 12L6 8L10 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                  onClick={handlePrevious}
                  variant="ghost"
                  size="sm"
                />
                <span className={styles.dateRange}>{dateRangeText}</span>
                <IconButton
                  icon={
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M6 4L10 8L6 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                  onClick={handleNext}
                  variant="ghost"
                  size="sm"
                />
              </div>
            </div>

            <div className={styles.headerRight}>
              {/* View Mode Selector */}
              <div className={styles.viewModeSelector}>
                <button
                  onClick={() => handleViewModeChange("day")}
                  className={`${styles.viewModeButton} ${viewMode === "day" ? styles.active : ""}`}
                >
                  Day
                </button>
                <button
                  onClick={() => handleViewModeChange("3day")}
                  className={`${styles.viewModeButton} ${viewMode === "3day" ? styles.active : ""}`}
                >
                  3 Day
                </button>
                <button
                  onClick={() => handleViewModeChange("week")}
                  className={`${styles.viewModeButton} ${viewMode === "week" ? styles.active : ""}`}
                >
                  Week
                </button>
                <button
                  onClick={() => handleViewModeChange("month")}
                  className={`${styles.viewModeButton} ${viewMode === "month" ? styles.active : ""}`}
                >
                  Month
                </button>
              </div>

              <div className={styles.headerActions}>
                {/* Driving Range Selector */}
                <div className={styles.drivingRangeButton}>
                  <span>Driving Range</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M6 4L10 8L6 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Add Button */}
                <Button onClick={handleAddEvent} className={styles.addButton}>
                  Add
                </Button>

                {/* Settings */}
                <IconButton
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  }
                  variant="ghost"
                />
              </div>
            </div>
          </div>

          {/* Professional Booking Calendar */}
          <div className={styles.calendarContainer}>
            <BookingCalendar
              viewMode={viewMode}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
            />
          </div>
        </div>
      </div>
    </CalendarProvider>
  );
}
