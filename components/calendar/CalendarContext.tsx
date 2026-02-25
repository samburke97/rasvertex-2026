// components/calendar/CalendarContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";

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

interface CalendarState {
  bookings: Booking[];
  selectedBooking: Booking | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

type CalendarAction =
  | { type: "SET_BOOKINGS"; payload: Booking[] }
  | { type: "ADD_BOOKING"; payload: Booking }
  | {
      type: "UPDATE_BOOKING";
      payload: { id: string; booking: Partial<Booking> };
    }
  | { type: "DELETE_BOOKING"; payload: string }
  | { type: "SELECT_BOOKING"; payload: Booking | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_LAST_UPDATE"; payload: Date };

const initialState: CalendarState = {
  bookings: [
    {
      id: "booking-1",
      bayId: "bay-1",
      startTime: new Date(2024, 7, 26, 9, 0),
      endTime: new Date(2024, 7, 26, 10, 0),
      title: "Golf Lesson",
      customer: "John Smith",
      service: "Private Lesson",
      color: "#10b981",
      status: "confirmed",
      price: 80,
    },
    {
      id: "booking-2",
      bayId: "bay-3",
      startTime: new Date(2024, 7, 26, 14, 0),
      endTime: new Date(2024, 7, 26, 15, 30),
      title: "Group Training",
      customer: "Sarah Johnson",
      service: "Group Session",
      color: "#8b5cf6",
      status: "confirmed",
      price: 120,
    },
  ],
  selectedBooking: null,
  isLoading: false,
  error: null,
  lastUpdate: null,
};

function calendarReducer(
  state: CalendarState,
  action: CalendarAction
): CalendarState {
  switch (action.type) {
    case "SET_BOOKINGS":
      return {
        ...state,
        bookings: action.payload,
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      };

    case "ADD_BOOKING":
      return {
        ...state,
        bookings: [...state.bookings, action.payload],
        lastUpdate: new Date(),
      };

    case "UPDATE_BOOKING":
      return {
        ...state,
        bookings: state.bookings.map((booking) =>
          booking.id === action.payload.id
            ? { ...booking, ...action.payload.booking }
            : booking
        ),
        selectedBooking:
          state.selectedBooking?.id === action.payload.id
            ? { ...state.selectedBooking, ...action.payload.booking }
            : state.selectedBooking,
        lastUpdate: new Date(),
      };

    case "DELETE_BOOKING":
      return {
        ...state,
        bookings: state.bookings.filter(
          (booking) => booking.id !== action.payload
        ),
        selectedBooking:
          state.selectedBooking?.id === action.payload
            ? null
            : state.selectedBooking,
        lastUpdate: new Date(),
      };

    case "SELECT_BOOKING":
      return {
        ...state,
        selectedBooking: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case "SET_LAST_UPDATE":
      return {
        ...state,
        lastUpdate: action.payload,
      };

    default:
      return state;
  }
}

interface CalendarContextType {
  state: CalendarState;
  bookings: Booking[];
  selectedBooking: Booking | null;
  isLoading: boolean;
  error: string | null;
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;
  selectBooking: (booking: Booking | null) => void;
  refreshBookings: () => Promise<void>;
  checkConflicts: (booking: Booking) => Booking[];
}

const CalendarContext = createContext<CalendarContextType | undefined>(
  undefined
);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState);

  // Add booking with conflict checking
  const addBooking = useCallback(
    (booking: Booking) => {
      const conflicts = checkConflicts(booking);
      if (conflicts.length > 0) {
        dispatch({
          type: "SET_ERROR",
          payload: "Booking conflicts with existing appointments",
        });
        return;
      }

      dispatch({ type: "ADD_BOOKING", payload: booking });

      // Simulate API call
      setTimeout(() => {
        console.log("Booking saved to API:", booking);
      }, 100);
    },
    [state.bookings]
  );

  // Update booking
  const updateBooking = useCallback(
    (id: string, updates: Partial<Booking>) => {
      const existingBooking = state.bookings.find((b) => b.id === id);
      if (!existingBooking) return;

      const updatedBooking = { ...existingBooking, ...updates };
      const conflicts = checkConflicts(updatedBooking, id);

      if (conflicts.length > 0) {
        dispatch({
          type: "SET_ERROR",
          payload: "Updated booking conflicts with existing appointments",
        });
        return;
      }

      dispatch({ type: "UPDATE_BOOKING", payload: { id, booking: updates } });

      // Simulate API call
      setTimeout(() => {
        console.log("Booking updated in API:", { id, updates });
      }, 100);
    },
    [state.bookings]
  );

  // Delete booking
  const deleteBooking = useCallback((id: string) => {
    dispatch({ type: "DELETE_BOOKING", payload: id });

    // Simulate API call
    setTimeout(() => {
      console.log("Booking deleted from API:", id);
    }, 100);
  }, []);

  // Select booking
  const selectBooking = useCallback((booking: Booking | null) => {
    dispatch({ type: "SELECT_BOOKING", payload: booking });
  }, []);

  // Check for booking conflicts
  const checkConflicts = useCallback(
    (booking: Booking, excludeId?: string): Booking[] => {
      return state.bookings.filter((existingBooking) => {
        if (excludeId && existingBooking.id === excludeId) return false;
        if (existingBooking.bayId !== booking.bayId) return false;

        const startTime = booking.startTime.getTime();
        const endTime = booking.endTime.getTime();
        const existingStart = existingBooking.startTime.getTime();
        const existingEnd = existingBooking.endTime.getTime();

        // Check for time overlap
        return startTime < existingEnd && endTime > existingStart;
      });
    },
    [state.bookings]
  );

  // Refresh bookings from API
  const refreshBookings = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // In real app, fetch from API:
      // const response = await fetch('/api/bookings');
      // const bookings = await response.json();
      // dispatch({ type: 'SET_BOOKINGS', payload: bookings });

      dispatch({ type: "SET_LOADING", payload: false });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to load bookings" });
    }
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    // In real app, connect to WebSocket:
    // const socket = io('/calendar');
    //
    // socket.on('booking-updated', (booking: Booking) => {
    //   dispatch({ type: 'UPDATE_BOOKING', payload: { id: booking.id, booking } });
    // });
    //
    // socket.on('booking-deleted', (bookingId: string) => {
    //   dispatch({ type: 'DELETE_BOOKING', payload: bookingId });
    // });
    //
    // return () => {
    //   socket.disconnect();
    // };

    console.log("Calendar context initialized with real-time updates");
  }, []);

  const contextValue: CalendarContextType = {
    state,
    bookings: state.bookings,
    selectedBooking: state.selectedBooking,
    isLoading: state.isLoading,
    error: state.error,
    addBooking,
    updateBooking,
    deleteBooking,
    selectBooking,
    refreshBookings,
    checkConflicts,
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error("useCalendar must be used within a CalendarProvider");
  }
  return context;
}
