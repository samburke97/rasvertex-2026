import ReportSelector from "@/components/reports/ReportSelector";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports | RAS-VERTEX",
  description: "Generate professional site reports from SimPRO jobs",
};

export default function ReportsPage() {
  return <ReportSelector />;
}
