import { NextResponse } from "next/server";

import { AgroServerError } from "@/lib/server/errors";
import {
  listAllowedExportDefinitions,
  listAvailableManifestExports,
  listPreferredSnapshotExportDefinitions,
  listResolvedExportsFromManifest,
  resolvePreferredSnapshotExportFromManifest,
} from "@/lib/server/export-registry";
import { buildExportManifestDiagnostics, readParsedExportManifest } from "@/lib/server/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const { manifest, rawBytes } = await readParsedExportManifest();
    const diagnostics = buildExportManifestDiagnostics(manifest, rawBytes);
    const availableSnapshotExport = resolvePreferredSnapshotExportFromManifest(manifest);
    const resolvedExports = listResolvedExportsFromManifest(manifest);

    return NextResponse.json({
      ok: true,
      ...diagnostics,
      runtimeContract: {
        manifestFields: ["generated_at", "exports"],
        exportFields: ["dataset", "table", "fully_qualified", "gcs_objects"],
        ignoredExportFields: ["signed_urls"],
      },
      allowedExports: listAllowedExportDefinitions(),
      preferredSnapshotExports: listPreferredSnapshotExportDefinitions(),
      availableSnapshotExport,
      availableExports: listAvailableManifestExports(manifest),
      resolvedExports: availableSnapshotExport ? [...resolvedExports, availableSnapshotExport] : resolvedExports,
    });
  } catch (error) {
    const statusCode = error instanceof AgroServerError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unknown GCS health check failure.";

    return NextResponse.json(
      {
        ok: false,
        error: {
          message,
          name: error instanceof Error ? error.name : "UnknownError",
        },
      },
      { status: statusCode },
    );
  }
}
