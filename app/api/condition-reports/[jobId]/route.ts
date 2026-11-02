// app/api/condition-reports/[jobId]/route.ts
// Draft persistence for Condition reports (see lib/reports/drafts.ts).

import { draftRoutes, hasJob } from "@/lib/reports/drafts";
import type { ConditionReportData } from "@/lib/reports/condition.types";

export const { GET, PATCH, DELETE } = draftRoutes<ConditionReportData>({
  table: "condition_reports",
  key: "job_id",
  param: "jobId",
  isValid: hasJob<ConditionReportData>,
  blobUrls: (d) => [d.job?.coverPhoto, ...(d.photos ?? []).map((p) => p.url)],
});
