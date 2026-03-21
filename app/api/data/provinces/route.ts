import { NextResponse } from "next/server";

import { getProvinceAnalyticsPayload } from "@/lib/server/agro-data";
import { AgroServerError } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await getProvinceAnalyticsPayload());
  } catch (error) {
    const statusCode = error instanceof AgroServerError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unknown province analytics error.";

    return NextResponse.json(
      {
        error: {
          message,
          name: error instanceof Error ? error.name : "UnknownError",
        },
      },
      { status: statusCode },
    );
  }
}
