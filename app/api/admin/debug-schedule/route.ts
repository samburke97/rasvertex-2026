// app/api/admin/debug-schedule/route.ts

import { NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;

export async function GET() {
  // Using a known schedule from the logs: job 10816, ref 10816-13301
  // Reference = jobID-costCenterID, service jobs have sectionID = 1
  const jobId = 10816;
  const sectionId = 1;
  const costCenterId = 13301;

  try {
    // 1. Fetch all schedules for this cost centre
    const schedules = await simproGet<any[]>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${jobId}/sections/${sectionId}/costCenters/${costCenterId}/schedules/`,
    );

    // 2. Fetch detail for first schedule to see full response
    const detail =
      schedules.length > 0
        ? await simproGet<any>(
            `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${jobId}/sections/${sectionId}/costCenters/${costCenterId}/schedules/${schedules[0].ID}`,
          )
        : null;

    return NextResponse.json({
      list: schedules,
      detail,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
