import { NextResponse } from "next/server";

import { getLocationDetailPayload } from "@/lib/server/agro-data";
import { AgroServerError } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RouteContext {
  params: Promise<{
    locationId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { locationId } = await context.params;
    return NextResponse.json(await getLocationDetailPayload(locationId));
  } catch (error) {
    const statusCode = error instanceof AgroServerError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unknown location detail error.";

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
