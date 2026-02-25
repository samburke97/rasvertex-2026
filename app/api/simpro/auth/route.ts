import { NextRequest, NextResponse } from "next/server";
import { SimproClient } from "@/lib/simpro-api";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, clientId, clientSecret } = await request.json();

    if (!baseUrl || !clientId || !clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required authentication parameters",
        },
        { status: 400 }
      );
    }

    const simpro = new SimproClient({
      baseUrl,
      clientId,
      clientSecret,
    });

    await simpro.authenticate();

    logger.info("SimPRO authentication test successful");

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
    });
  } catch (error) {
    logger.error("SimPRO authentication test failed", error as Error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 401 }
    );
  }
}
