import TodayPage from "@/components/dashboard/TodayPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today | RAS-VERTEX",
  description: "What needs you today, and what's riding on it",
};

export default function DashboardPage() {
  return <TodayPage />;
}
