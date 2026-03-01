// app/api/simpro/jobs/[jobId]/schedule/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// SimPRO schedule data lives at:
//   /jobs/{jobID}/sections/{sectionID}/costCenters/{costCenterID}/schedules/
//
// Flow:
//   1. GET /jobs/{jobID}/sections/                          → section IDs
//   2. GET /jobs/{jobID}/sections/{id}/costCenters/         → cost centre IDs (parallel)
//   3. GET /jobs/{jobID}/sections/{id}/costCenters/{id}/schedules/ → rows (parallel)
//
// Response shape (from API docs):
//   { ID, TotalHours, Staff: { ID, Name, Type, TypeId }, Date }
// ─────────────────────────────────────────────────────────────────────────────

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

interface SimproScheduleEntry {
  ID: number;
  TotalHours?: number;
  Staff?: { ID: number; Name: string; Type?: string; TypeId?: number };
  Date?: string;
  Notes?: string;
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
  const dateFrom = searchParams.get("dateFrom") ?? null;
  const dateTo = searchParams.get("dateTo") ?? null;

  const base = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}`;

  try {
    // ── Step 1: Get sections ──────────────────────────────────────────────────
    console.log(`[Schedule] Fetching sections for job ${parsedJobId}`);
    const sections = await simproFetch<SimproSection[]>(
      `${base}/sections/?pageSize=250`,
    );
    console.log(`[Schedule] ${sections.length} sections`);

    if (sections.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    // ── Step 2: Get cost centres for all sections (parallel) ──────────────────
    const costCentreResults = await Promise.all(
      sections.map(async (section) => {
        try {
          const ccs = await simproFetch<SimproCostCentre[]>(
            `${base}/sections/${section.ID}/costCenters/?pageSize=250`,
          );
          return { sectionId: section.ID, costCentres: ccs };
        } catch (err) {
          console.warn(
            `[Schedule] Section ${section.ID} costCenters failed:`,
            err instanceof Error ? err.message : err,
          );
          return { sectionId: section.ID, costCentres: [] };
        }
      }),
    );

    // Flatten to array of { sectionId, costCentreId }
    const pairs: Array<{ sectionId: number; costCentreId: number }> = [];
    for (const { sectionId, costCentres } of costCentreResults) {
      for (const cc of costCentres) {
        pairs.push({ sectionId, costCentreId: cc.ID });
      }
    }
    console.log(
      `[Schedule] ${pairs.length} cost centre(s) to fetch schedules for`,
    );

    if (pairs.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    // ── Step 3: Get schedules for all cost centres (parallel) ─────────────────
    const scheduleResults = await Promise.all(
      pairs.map(async ({ sectionId, costCentreId }) => {
        try {
          const schedules = await simproFetch<SimproScheduleEntry[]>(
            `${base}/sections/${sectionId}/costCenters/${costCentreId}/schedules/?pageSize=250`,
          );
          return schedules;
        } catch (err) {
          console.warn(
            `[Schedule] Section ${sectionId} CC ${costCentreId} schedules failed:`,
            err instanceof Error ? err.message : err,
          );
          return [];
        }
      }),
    );

    // Flatten all schedule entries
    const allEntries = scheduleResults.flat();
    console.log(
      `[Schedule] ${allEntries.length} schedule entries for job ${parsedJobId}`,
    );

    // ── Map to ScheduleRow ────────────────────────────────────────────────────
    let rows = allEntries
      .filter((e) => e.Date) // must have a date
      .map((e) => ({
        id: String(e.ID),
        employeeId: e.Staff?.ID ?? 0,
        employeeName: e.Staff?.Name ?? "Unknown",
        date: e.Date!,
        scheduledHours: Number(e.TotalHours ?? 0),
        actualHours: Number(e.TotalHours ?? 0),
        note: e.Notes ?? "",
      }));

    // ── Date filtering ────────────────────────────────────────────────────────
    if (dateFrom) rows = rows.filter((r) => r.date >= dateFrom);
    if (dateTo) rows = rows.filter((r) => r.date <= dateTo);

    // Sort by date then employee name
    rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.employeeName.localeCompare(b.employeeName),
    );

    console.log(`[Schedule] Returning ${rows.length} rows`);
    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Schedule] Fatal error for job ${parsedJobId}:`, message);
    return NextResponse.json({ rows: [], error: message });
  }
}
