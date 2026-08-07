import CrmDashboard from "@/components/crm/CrmDashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM | RAS-VERTEX",
  description: "Track leads and move them through your sales pipeline",
};

export default function CrmPage() {
  return <CrmDashboard />;
}
