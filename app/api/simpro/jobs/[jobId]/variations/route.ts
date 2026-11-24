// app/api/simpro/jobs/[jobId]/variations/route.ts
// A job's variations for the Job overview: each cost centre marked
// Variation, with its name, description (HTML) and the labour hours logged
// to it (Totals.ResourcesCost.LaborHours.Actual).

import { NextRequest, NextResponse } from "next/server";
import { simproGetRetry as get } from "@/lib/simpro/client";
import type { SimproVariation } from "@/lib/reports/condition.types";

const API = `${process.env.NEXT_PUBLIC_SIMPRO_BASE_URL}/api/v1.0/companies/0`;

interface SimproCostCentre {
  ID: number;
  Name?: string;
  Description?: string;
  Variation?: boolean;
  VariationApprovalDate?: string | null;
  Totals?: { ResourcesCost?: { LaborHours?: { Actual?: number } } };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^\d{1,8}$/.test(jobId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  try {
    const jobPath = `${API}/jobs/${jobId}`;
    const sections = await get<{ ID: number }[]>(`${jobPath}/sections/?columns=ID`);
    const variations: SimproVariation[] = [];
    for (const s of sections) {
      const ccs = await get<{ ID: number }[]>(`${jobPath}/sections/${s.ID}/costCenters/?columns=ID`);
      for (const { ID } of ccs) {
        const cc = await get<SimproCostCentre>(
          `${jobPath}/sections/${s.ID}/costCenters/${ID}?columns=ID,Name,Description,Variation,VariationApprovalDate,Totals`,
        );
        if (!cc.Variation) continue;
        variations.push({
          ccId: String(cc.ID),
          sectionId: String(s.ID),
          name: (cc.Name ?? "").trim(),
          description: cc.Description ?? "",
          hours: cc.Totals?.ResourcesCost?.LaborHours?.Actual ?? 0,
          approved: cc.VariationApprovalDate || null,
        });
      }
    }
    return NextResponse.json({ variations });
  } catch (err) {
    console.error(`[SimPRO job ${jobId} variations]`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't read the job's variations" }, { status: 502 });
  }
}
