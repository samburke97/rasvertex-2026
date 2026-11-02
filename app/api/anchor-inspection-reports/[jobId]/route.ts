// app/api/anchor-inspection-reports/[jobId]/route.ts
// Draft persistence for Anchor Inspection reports (see lib/reports/drafts.ts).

import { draftRoutes, hasJob } from "@/lib/reports/drafts";
import type { AnchorReportData } from "@/lib/reports/anchor.types";

export const { GET, PATCH, DELETE } = draftRoutes<AnchorReportData>({
  table: "anchor_inspection_reports",
  key: "job_id",
  param: "jobId",
  isValid: hasJob<AnchorReportData>,
  blobUrls: (d) => [...(d.photos ?? []).map((p) => p.url), ...(d.zones ?? []).map((z) => z.mapImageUrl)],
});
