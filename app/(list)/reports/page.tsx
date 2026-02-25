import ReportWizard from "@/components/reports/ReportWizard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Photo Grid Report Builder | SimPRO CRM",
  description:
    "Generate professional photo reports from SimPRO jobs or uploaded images",
};

export default function HomePage() {
  return <ReportWizard />;
}
