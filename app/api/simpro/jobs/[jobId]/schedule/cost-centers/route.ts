// app/api/simpro/jobs/[jobId]/schedule/cost-centers/route.ts
//
// Lists a job's sections + cost centres so the report editor can offer
// "import all hours" vs "import hours logged to this cost centre only"
// before the schedule fetch begins. Mirrors the attachments/folders route.

import { NextRequest, NextResponse } from "next/server";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

interface SimproSection {
  ID: number;
  Name?: string;
}

interface SimproCostCentre {
  ID: number;
  Name?: string;
}

async function simproFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const parsedJobId = parseInt(jobId, 10);
  if (!jobId || isNaN(parsedJobId) || parsedJobId <= 0) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = parseInt(searchParams.get("companyId") || "0", 10);
  const base = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}`;

  try {
    const sections = await simproFetch<SimproSection[]>(
      `${base}/sections/?pageSize=250`,
    );

    if (sections.length === 0) {
      return NextResponse.json({ costCenters: [] });
    }

    const results = await Promise.all(
      sections.map(async (section) => {
        try {
          const ccs = await simproFetch<SimproCostCentre[]>(
            `${base}/sections/${section.ID}/costCenters/?pageSize=250`,
          );
          return { section, costCentres: ccs };
        } catch (err) {
          console.warn(
            `[ScheduleCostCenters] Section ${section.ID} costCenters failed:`,
            err instanceof Error ? err.message : err,
          );
          return { section, costCentres: [] as SimproCostCentre[] };
        }
      }),
    );

    // Only prefix with the section name when there's more than one section —
    // otherwise the cost centre name alone reads cleaner in the picker.
    const multiSection = sections.length > 1;
    const costCenters = results.flatMap(({ section, costCentres }) =>
      costCentres.map((cc) => ({
        id: cc.ID,
        sectionId: section.ID,
        name: multiSection
          ? `${section.Name ?? "Section"} / ${cc.Name ?? "Cost Centre"}`
          : (cc.Name ?? "Cost Centre"),
      })),
    );

    return NextResponse.json({ costCenters });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(
      `[ScheduleCostCenters] Failed for job ${parsedJobId}:`,
      message,
    );
    return NextResponse.json({ costCenters: [] });
  }
}
