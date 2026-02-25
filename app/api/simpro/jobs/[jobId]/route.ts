// app/api/simpro/jobs/[jobId]/route.ts - Properly typed
import { NextRequest, NextResponse } from "next/server";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

// Define the expected job details response structure
interface SimproJobDetails {
  ID: number;
  Name: string;
  Description?: string;
  Status?: string;
  Customer?: {
    ID: number;
    Name: string;
  };
  Site?: {
    ID: number;
    Name: string;
    Address?: string;
  };
  DateCreated?: string;
  DateScheduled?: string;
  // Add other fields as needed
  [key: string]: unknown; // Allow additional fields
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  console.log(`Making API request to: ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  console.log(`Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Error Response: ${errorText}`);
    throw new Error(
      `HTTP error! status: ${response.status} - ${response.statusText}`
    );
  }

  const data = await response.json();
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  console.log(`=== SIMPRO JOB DETAILS REQUEST ===`);
  console.log(`Job ID: ${jobId}`);
  console.log(`Request URL: ${request.url}`);

  // Validate environment variables
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    console.error("Missing required environment variables");
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 }
    );
  }

  // Validate job ID
  if (!jobId || jobId.trim() === "") {
    console.error(`Invalid job ID: ${jobId}`);
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  const parsedJobId = parseInt(jobId, 10);
  if (isNaN(parsedJobId) || parsedJobId <= 0) {
    console.error(`Job ID is not valid: ${jobId}`);
    return NextResponse.json(
      { error: `Job ID must be a valid positive number: ${jobId}` },
      { status: 400 }
    );
  }

  try {
    // Use the same API pattern as your working attachments endpoint
    const jobUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${parsedJobId}/`;

    console.log(`Fetching job details from: ${jobUrl}`);

    // Now properly typed as SimproJobDetails
    const jobDetails = await apiRequest<SimproJobDetails>(jobUrl);

    console.log(`Successfully fetched job: ${jobDetails.Name || "Unknown"}`);
    console.log(`Site info:`, {
      siteName: jobDetails.Site?.Name,
      siteAddress: jobDetails.Site?.Address,
      customerName: jobDetails.Customer?.Name,
    });

    return NextResponse.json(jobDetails);
  } catch (error) {
    console.error(`Error fetching job ${jobId}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to fetch job details",
        details: errorMessage,
        jobId,
      },
      { status: 500 }
    );
  }
}
