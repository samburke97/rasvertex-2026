// app/api/admin/debug-schedule/route.ts

import { NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;

export async function GET() {
  const jobId = 10816;

  try {
    // 1. Get sections for this job
    const sections = await simproGet<any[]>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${jobId}/sections/`,
    );

    if (sections.length === 0) {
      return NextResponse.json({ error: "No sections found" });
    }

    const sectionId = sections[0].ID;

    // 2. Get cost centres for first section
    const costCentres = await simproGet<any[]>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${jobId}/sections/${sectionId}/costCenters/`,
    );

    if (costCentres.length === 0) {
      return NextResponse.json({ sections, error: "No cost centres found" });
    }

    const costCentreId = costCentres[0].ID;

    // 3. Get schedules for first cost centre
    const schedules = await simproGet<any[]>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${jobId}/sections/${sectionId}/costCenters/${costCentreId}/schedules/`,
    );

    if (schedules.length === 0) {
      return NextResponse.json({
        sections,
        costCentres,
        error: "No schedules found",
      });
    }

    // 4. Get detail for first schedule
    const detail = await simproGet<any>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${jobId}/sections/${sectionId}/costCenters/${costCentreId}/schedules/62256`,
    );
    return NextResponse.json({
      sectionId,
      costCentreId,
      scheduleList: schedules,
      scheduleDetail: detail,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
