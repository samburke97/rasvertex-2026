// app/api/reports/project-progress/job/[jobId]/route.ts
// One SimPRO job for the Project progress report: its name, site, stage,
// price ex GST (Total.ExTax), labour hours used and estimated
// (Totals.ResourcesCost.LaborHours) and its linked variations.

import { NextRequest, NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import { cleanSite } from "@/lib/reports/weekSchedule";
import type { ProgressJob } from "@/lib/reports/projectProgress";

const API = `${process.env.NEXT_PUBLIC_SIMPRO_BASE_URL}/api/v1.0/companies/0`;

interface SimproJob {
  ID: number;
  Name?: string;
  Stage?: string;
  Status?: { Name?: string };
  Site?: { ID?: number; Name?: string };
  Customer?: { CompanyName?: string; GivenName?: string; FamilyName?: string };
  IsVariation?: boolean;
  LinkedVariations?: ({ ID?: number } | number)[];
  Total?: { ExTax?: number };
  Totals?: { ResourcesCost?: { LaborHours?: { Actual?: number; Estimate?: number } } };
  CompletedDate?: string | null;
}

/** SimPRO's rate limit answers 429: wait a moment and ask again. */
async function get<T>(url: string, tries = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await simproGet<T>(url);
    } catch (err) {
      if (i >= tries || !/HTTP 429/.test(String(err))) throw err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** (i - 1)));
    }
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^\d{1,8}$/.test(jobId)) return NextResponse.json({ error: "Enter a job number" }, { status: 400 });
  try {
    const j = await get<SimproJob>(
      `${API}/jobs/${jobId}?columns=ID,Name,Stage,Status,Site,Customer,IsVariation,LinkedVariations,Total,Totals,CompletedDate`,
    );
    const c = j.Customer;
    const hours = j.Totals?.ResourcesCost?.LaborHours;
    const job: ProgressJob = {
      id: String(j.ID),
      name: (j.Name ?? "").trim(),
      site: cleanSite(j.Site?.Name ?? ""),
      siteId: j.Site?.ID ? String(j.Site.ID) : "",
      customer: cleanSite(c?.CompanyName?.trim() || [c?.GivenName, c?.FamilyName].filter(Boolean).join(" ")),
      stage: j.Stage ?? "",
      status: (j.Status?.Name ?? "").trim(),
      isVariation: !!j.IsVariation,
      linked: (j.LinkedVariations ?? [])
        .map((v) => (typeof v === "number" ? v : v?.ID))
        .filter((v): v is number => !!v)
        .map(String),
      priceExTax: j.Total?.ExTax ?? 0,
      hoursUsed: hours?.Actual ?? 0,
      hoursEstimate: hours?.Estimate ?? 0,
      completedDate: j.CompletedDate || null,
    };
    return NextResponse.json({ job });
  } catch (err) {
    const msg = String(err);
    const status = /HTTP 404/.test(msg) ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? `Job ${jobId} isn't in SimPRO` : "Couldn't read SimPRO" }, { status });
  }
}
