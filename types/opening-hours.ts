// Types for opening hours management

export interface TimeSlot {
  id?: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface OpeningHoursData {
  [key: number]: TimeSlot[]; // key is day of week (0-6, Monday to Sunday)
}

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Helper to format time for display
export function formatTimeDisplay(time: string): string {
  // Convert 24h format to 12h format
  try {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  } catch (e) {
    return time;
  }
}

// Helper to format time range for display
export function formatTimeRange(openTime: string, closeTime: string): string {
  return `${formatTimeDisplay(openTime)} - ${formatTimeDisplay(closeTime)}`;
}

// Generate time options for dropdowns
export function generateTimeOptions(): string[] {
  const options: string[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const hourStr = hour.toString().padStart(2, "0");
      const minuteStr = minute.toString().padStart(2, "0");
      options.push(`${hourStr}:${minuteStr}`);
    }
  }

  return options;
}

// Get default time options
export function getDefaultTimeSlot(): TimeSlot {
  return {
    isOpen: true,
    openTime: "09:00",
    closeTime: "17:00",
  };
}
