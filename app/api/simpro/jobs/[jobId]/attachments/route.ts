// app/api/simpro/jobs/[jobId]/attachments/route.ts - Simplified and properly typed
import { NextRequest, NextResponse } from "next/server";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

// Types based on SimPRO API documentation
interface SimproAttachmentList {
  ID: string;
  Filename: string;
}

interface SimproAttachmentDetail {
  ID: string;
  Filename: string;
  Folder?: {
    ID: number;
    Name: string;
  } | null;
  Public?: boolean;
  Email?: boolean;
  MimeType?: string;
  FileSizeBytes?: number;
  DateAdded?: string;
  AddedBy?: {
    ID: number;
    Name: string;
    Type: string;
    TypeId: number;
  } | null;
  Base64Data?: string; // Only present when using ?display=Base64
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
  console.log(
    `Received ${Array.isArray(data) ? data.length : "non-array"} items`
  );
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { searchParams } = new URL(request.url);
  const companyId = parseInt(searchParams.get("companyId") || "0");

  console.log(`=== SIMPRO ATTACHMENTS REQUEST ===`);
  console.log(`Job ID from params: ${jobId} (type: ${typeof jobId})`);
  console.log(`Company ID: ${companyId}`);
  console.log(`Full URL: ${request.url}`);

  // Validate environment variables
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    console.error("Missing required environment variables");
    console.error("SIMPRO_BASE_URL:", SIMPRO_BASE_URL ? "✓ Set" : "✗ Missing");
    console.error(
      "SIMPRO_ACCESS_TOKEN:",
      SIMPRO_ACCESS_TOKEN ? "✓ Set" : "✗ Missing"
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "SimPRO configuration missing. Please check environment variables.",
        code: "CONFIGURATION_MISSING",
      },
      { status: 500 }
    );
  }

  // Validate job ID - check for undefined, null, or empty string
  if (!jobId || jobId === "undefined" || jobId.trim() === "") {
    console.error(
      `Invalid job ID received: "${jobId}" (type: ${typeof jobId})`
    );
    return NextResponse.json(
      {
        success: false,
        error: `Invalid job ID: "${jobId}". Please provide a valid job number.`,
        code: "INVALID_JOB_ID",
      },
      { status: 400 }
    );
  }

  const parsedJobId = parseInt(jobId, 10);
  if (isNaN(parsedJobId) || parsedJobId <= 0) {
    console.error(`Job ID is not a valid number: ${jobId}`);
    return NextResponse.json(
      {
        success: false,
        error: `Job ID must be a valid positive number. Received: "${jobId}"`,
        code: "INVALID_JOB_ID_FORMAT",
      },
      { status: 400 }
    );
  }

  try {
    console.log(`Fetching attachments for job ${parsedJobId}...`);

    // Step 1: Get list of all attachments for the job
    const listAttachmentsUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/files/?pageSize=250`;

    console.log(`Fetching attachment list from: ${listAttachmentsUrl}`);
    const attachmentsList = await apiRequest<SimproAttachmentList[]>(
      listAttachmentsUrl
    );

    console.log(`Found ${attachmentsList.length} total attachments`);

    if (attachmentsList.length === 0) {
      console.log(`No attachments found for job ${parsedJobId}`);
      return NextResponse.json({
        success: true,
        attachments: [],
        message: `No attachments found for job ${parsedJobId}`,
      });
    }

    // Step 2: Get detailed info for each attachment with Base64 data
    console.log("Fetching detailed attachment info...");
    const detailedAttachments: SimproAttachmentDetail[] = [];

    for (const attachment of attachmentsList) {
      try {
        console.log(`Getting details for attachment: ${attachment.Filename}`);

        const detailUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/files/${attachment.ID}?display=Base64`;
        const detailedAttachment = await apiRequest<SimproAttachmentDetail>(
          detailUrl
        );

        // Only include image attachments
        if (
          detailedAttachment.MimeType &&
          detailedAttachment.MimeType.startsWith("image/")
        ) {
          console.log(`✓ Added image: ${detailedAttachment.Filename}`);
          detailedAttachments.push(detailedAttachment);
        } else {
          console.log(
            `✗ Skipped non-image: ${detailedAttachment.Filename} (${detailedAttachment.MimeType})`
          );
        }
      } catch (error) {
        console.warn(
          `Failed to get details for attachment ${attachment.ID}:`,
          error as Error
        );
        // Continue with other attachments
      }
    }

    console.log(
      `Returning ${detailedAttachments.length} image attachments for job ${parsedJobId}`
    );

    return NextResponse.json({
      success: true,
      attachments: detailedAttachments,
      total: detailedAttachments.length,
      jobId: parsedJobId,
    });
  } catch (error) {
    console.error(
      `Error fetching attachments for job ${jobId}:`,
      error as Error
    );

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check for specific SimPRO errors
    if (errorMessage.includes("404")) {
      return NextResponse.json(
        {
          success: false,
          error: `Job ${parsedJobId} not found in SimPRO`,
          code: "JOB_NOT_FOUND",
          details: errorMessage,
        },
        { status: 404 }
      );
    }

    if (errorMessage.includes("401") || errorMessage.includes("403")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed with SimPRO API",
          code: "AUTHENTICATION_FAILED",
          details: errorMessage,
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch job attachments",
        code: "FETCH_FAILED",
        details: errorMessage,
        jobId: parsedJobId,
      },
      { status: 500 }
    );
  }
}
