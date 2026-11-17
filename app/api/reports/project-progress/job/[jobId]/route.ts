// app/api/reports/project-progress/job/[jobId]/route.ts
// One SimPRO job for the Project progress report, cost centre by cost
// centre: its original scope and each variation (a variation is a cost
// centre with Variation: true, in its own section). For each: name, stage,
// price ex GST (Total.ExTax) and labour hours used and estimated
// (Totals.ResourcesCost.LaborHours). A cost centre with hours but no price
// yet is priced at its labour sell rate × the hours worked.

import { NextRequest, NextResponse } from "next/server";
import { simproGetRetry } from "@/lib/simpro/client";
import { cleanSite } from "@/lib/reports/weekSchedule";
import type { ProgressJob } from "@/lib/reports/projectProgress";

const API = `${process.env.NEXT_PUBLIC_SIMPRO_BASE_URL}/api/v1.0/companies/0`;

interface SimproJob {
  ID: number;
  Name?: string;
  Site?: { ID?: number; Name?: string };
  Customer?: { CompanyName?: string; GivenName?: string; FamilyName?: string };
  CompletedDate?: string | null;
}

interface SimproCostCentre {
  ID: number;
  Name?: string;
  Stage?: string;
  Variation?: boolean;
  Total?: { ExTax?: number };
  Totals?: { ResourcesCost?: { LaborHours?: { Actual?: number; Estimate?: number } } };
}

const get = simproGetRetry;

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^\d{1,8}$/.test(jobId)) return NextResponse.json({ error: "Enter a job number" }, { status: 400 });
  try {
    const job = await get<SimproJob>(`${API}/jobs/${jobId}?columns=ID,Name,Site,Customer,CompletedDate`);
    const sections = await get<{ ID: number }[]>(`${API}/jobs/${jobId}/sections/?columns=ID`);
    const c = job.Customer;
    const base = {
      jobId: String(job.ID),
      jobName: (job.Name ?? "").trim(),
      site: cleanSite(job.Site?.Name ?? ""),
      siteId: job.Site?.ID ? String(job.Site.ID) : "",
      customer: cleanSite(c?.CompanyName?.trim() || [c?.GivenName, c?.FamilyName].filter(Boolean).join(" ")),
    };

    const items: ProgressJob[] = [];
    for (const s of sections) {
      const ccs = await get<{ ID: number }[]>(`${API}/jobs/${jobId}/sections/${s.ID}/costCenters/?columns=ID`);
      for (const { ID } of ccs) {
        const path = `${API}/jobs/${jobId}/sections/${s.ID}/costCenters/${ID}`;
        const cc = await get<SimproCostCentre>(`${path}?columns=ID,Name,Stage,Variation,Total,Totals`);
        const hours = cc.Totals?.ResourcesCost?.LaborHours;
        const used = hours?.Actual ?? 0;
        let price = cc.Total?.ExTax ?? 0;
        let fromHours = false;
        // Not priced yet but worked on (a do-and-charge variation): the
        // hours at the cost centre's labour sell rate.
        if (!price && used > 0) {
          const labour = await get<{ SellPrice?: { ExTax?: number } }[]>(`${path}/labor/`).catch(() => []);
          const rate = labour.find((l) => l.SellPrice?.ExTax)?.SellPrice?.ExTax ?? 0;
          if (rate) {
            price = r2(used * rate);
            fromHours = true;
          }
        }
        items.push({
          ...base,
          id: `${base.jobId}-${cc.ID}`,
          ccId: String(cc.ID),
          name: (cc.Name ?? "").trim(),
          stage: cc.Stage ?? "",
          isVariation: !!cc.Variation,
          priceExTax: price,
          priceFromHours: fromHours,
          hoursUsed: used,
          hoursEstimate: hours?.Estimate ?? 0,
          completedDate: job.CompletedDate || null,
        });
      }
    }
    // The original scope first, then the variations.
    items.sort((a, b) => Number(a.isVariation) - Number(b.isVariation));
    return NextResponse.json({ items });
  } catch (err) {
    const msg = String(err);
    const status = /HTTP 404/.test(msg) ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? `Job ${jobId} isn't in SimPRO` : "Couldn't read SimPRO" }, { status });
  }
}
