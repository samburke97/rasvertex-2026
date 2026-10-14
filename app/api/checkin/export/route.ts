// app/api/checkin/export/route.ts
//
// CSV downloads (UTF-8 BOM + CRLF so Excel opens them cleanly):
//   ?type=clients  (default) one row per client, priority order, with the
//                  top 3 recommendations and a ready-to-send email
//   ?type=quality  data-quality issues to fix in SimPRO

import { NextRequest } from "next/server";
import { fmtDate, type CheckinClient } from "@/lib/checkin/analyse";
import { composeEmail, pickAngle } from "@/lib/checkin/email";
import { getDataQuality, listAllCheckinClients } from "@/lib/checkin/store";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
const round = (n?: number) => (n ? Math.round(n) : "");

function clientRows(clients: CheckinClient[]): unknown[][] {
  const headers = [
    "Priority score", "Client", "Client type", "Primary contact", "Email", "Email flag", "Phone",
    "Other contacts", "Shares email with", "Sites", "Main site", "Main suburb",
    "Total jobs", "Lifetime value (AUD ex GST)", "First job", "Last job date", "Months since last job",
    "Cost centres used", "Last job", "Last job cost centre", "Last job value (AUD ex GST)",
    "Open quotes", "Open quotes value (AUD ex GST)", "Unpaid invoices", "Unpaid amount (AUD ex GST)",
    "Work in progress", "Do not send",
    "Recommendation 1", "Reason 1", "Recommendation 2", "Reason 2", "Recommendation 3", "Reason 3",
    "Email subject", "Email body", "Summary", "SimPRO customer ID",
  ];
  return [
    headers,
    ...clients.map((c) => {
      const a = c.angles;
      const email = c.doNotSend || !c.email ? null : composeEmail(c, pickAngle(c));
      return [
        c.score, c.name, c.type, c.contactName, c.email, c.email ? "" : "NO EMAIL", c.phone,
        c.otherContacts.join("; "), c.sharedWith.join("; "), c.siteCount, c.site, c.suburb,
        c.jobCount, round(c.ltv), fmtDate(c.firstJob), fmtDate(c.lastJob?.date), c.monthsSince ?? "",
        c.costCentres.join("; "), c.lastJob?.desc ?? "", c.lastJob?.cc ?? "", round(c.lastJob?.value),
        c.openQuotes.length || "", round(c.openQuoteValue), c.unpaid.length || "", round(c.unpaidOwing),
        c.inProgress.join("; "), c.doNotSend ? "YES" : "",
        a[0]?.title, a[0]?.reason, a[1]?.title, a[1]?.reason, a[2]?.title, a[2]?.reason,
        email?.subject ?? "", email?.body ?? "", c.summary, c.id,
      ];
    }),
  ];
}

export async function GET(request: NextRequest) {
  const quality = request.nextUrl.searchParams.get("type") === "quality";
  try {
    const rows = quality
      ? [["Issue", "Client", "Detail", "SimPRO customer ID"], ...(await getDataQuality()).map((r) => [r.issue, r.client, r.detail, r.clientId])]
      : clientRows(await listAllCheckinClients());
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${quality ? "checkin_data_quality" : "clients_checkin"}_${date}.csv"`,
      },
    });
  } catch (err) {
    console.error("[Checkin] export failed:", err);
    return new Response("Export failed.", { status: 500 });
  }
}
