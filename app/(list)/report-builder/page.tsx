import ReportWizard from "@/components/report-builder/ReportWizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report Builder | RAS-VERTEX",
  description: "Generate professional site reports from SimPRO jobs",
};

export default function ReportBuilderPage() {
  return <ReportWizard />;
}
