// app/api/works-agreements/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  getAllAgreements,
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";

export async function GET() {
  try {
    const agreements = await getAllAgreements();
    return NextResponse.json({ agreements });
  } catch (error) {
    console.error("[Works Agreements] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load agreements" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      jobId,
      jobNo,
      jobName,
      clientName,
      siteAddress,
      siteName,
      initialWorks,
      colourScheme,
      totalIncGst,
      date,
    } = body;

    if (!jobId || !totalIncGst) {
      return NextResponse.json(
        { error: "jobId and totalIncGst are required" },
        { status: 400 },
      );
    }

    const existing = await getAgreement(String(jobId));
    if (existing) {
      return NextResponse.json(
        { error: "Agreement already exists for this job", existing },
        { status: 409 },
      );
    }

    const agreement = {
      jobId: String(jobId),
      jobNo: jobNo || `#${jobId}`,
      jobName: jobName || `Job ${jobId}`,
      clientName: clientName || "Client",
      siteAddress: siteAddress || "",
      siteName: siteName || clientName || "",
      initialWorks: initialWorks || "",
      colourScheme: colourScheme || "To be advised",
      totalIncGst: Number(totalIncGst),
      paymentSchedule: buildPaymentSchedule(Number(totalIncGst)),
      date: date || new Date().toLocaleDateString("en-AU"),
      createdAt: new Date().toISOString(),
      status: "draft" as const,
      triggeredBy: "manual" as const,
    };

    await saveAgreement(agreement);
    return NextResponse.json({ success: true, agreement }, { status: 201 });
  } catch (error) {
    console.error("[Works Agreements] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
