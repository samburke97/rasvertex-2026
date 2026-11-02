// app/api/proposal-reports/[quoteId]/route.ts
// Draft persistence for proposals, keyed by SimPRO quote (see
// lib/reports/drafts.ts). Drafts from older builder versions aren't loaded:
// the builder starts fresh from the quote.

import { draftRoutes } from "@/lib/reports/drafts";
import { isProposal, type Proposal } from "@/lib/reports/proposal/v3/types";

export const { GET, PATCH, DELETE } = draftRoutes<Proposal>({
  table: "proposal_reports",
  key: "quote_id",
  param: "quoteId",
  isValid: isProposal,
  blobUrls: (d) => [...(d.simpro?.photos ?? []).map((p) => p.url), ...(d.uploads ?? [])],
});
