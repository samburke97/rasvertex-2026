import ReportingDashboard from "@/components/dashboard/ReportingDashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | RAS-VERTEX",
  description: "KPIs, revenue, and job status at a glance",
};

export default function DashboardPage() {
  return <ReportingDashboard />;
}
