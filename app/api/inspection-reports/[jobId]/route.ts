// app/api/inspection-reports/[jobId]/route.ts
// Draft persistence for building and roof inspection reports; the roof
// report's key is "<job>-roof" (see lib/reports/drafts.ts).

import { draftRoutes } from "@/lib/reports/drafts";
import { isInspectionData, type InspectionReportData } from "@/lib/reports/inspection/types";

export const { GET, PATCH, DELETE } = draftRoutes<InspectionReportData>({
  table: "inspection_reports",
  key: "job_id",
  param: "jobId",
  isValid: isInspectionData,
  blobUrls: (d) => (d.photos ?? []).map((p) => p.url),
});
