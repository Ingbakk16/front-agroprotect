import "server-only";

import type { ExportManifest } from "@/lib/server/manifest";
import { AgroExportResolutionError } from "@/lib/server/errors";

export type LogicalTableName =
  | "dim_location"
  | "fct_weather_daily"
  | "fct_tax_province"
  | "fct_yield_province_campaign"
  | "mart_agro_province_campaign";

export type ExportSizeClass = "small" | "large";
export type ExportRole = "primary" | "support";

export interface AllowedExportDefinition {
  canonicalKey: string;
  dataset: string;
  logicalName: LogicalTableName;
  role: ExportRole;
  sizeClass: ExportSizeClass;
  table: string;
}

export interface AvailableManifestExport {
  canonicalKey: string;
  dataset: string;
  fullyQualified: string;
  shardCount: number;
  table: string;
  tableType: string | null;
}

export interface ResolvedExport extends AllowedExportDefinition {
  fullyQualified: string;
  generatedAt: string;
  shardCount: number;
  shardPaths: string[];
}

export interface PreferredSnapshotExportDefinition {
  canonicalKey: string;
  dataset: string;
  logicalName: "app_location_snapshot" | "latest_weather_by_location";
  table: string;
}

export interface ResolvedPreferredSnapshotExport extends PreferredSnapshotExportDefinition {
  fullyQualified: string;
  generatedAt: string;
  shardCount: number;
  shardPaths: string[];
}

const allowedExportDefinitions: readonly AllowedExportDefinition[] = [
  {
    logicalName: "dim_location",
    canonicalKey: "marts.dim_location",
    dataset: "marts",
    table: "dim_location",
    role: "primary",
    sizeClass: "small",
  },
  {
    logicalName: "fct_weather_daily",
    canonicalKey: "marts.fct_weather_daily",
    dataset: "marts",
    table: "fct_weather_daily",
    role: "primary",
    sizeClass: "large",
  },
  {
    logicalName: "fct_tax_province",
    canonicalKey: "marts.fct_tax_province",
    dataset: "marts",
    table: "fct_tax_province",
    role: "support",
    sizeClass: "small",
  },
  {
    logicalName: "fct_yield_province_campaign",
    canonicalKey: "marts.fct_yield_province_campaign",
    dataset: "marts",
    table: "fct_yield_province_campaign",
    role: "support",
    sizeClass: "small",
  },
  {
    logicalName: "mart_agro_province_campaign",
    canonicalKey: "marts.mart_agro_province_campaign",
    dataset: "marts",
    table: "mart_agro_province_campaign",
    role: "primary",
    sizeClass: "small",
  },
] as const;

const preferredSnapshotExportDefinitions: readonly PreferredSnapshotExportDefinition[] = [
  {
    logicalName: "app_location_snapshot",
    canonicalKey: "marts.app_location_snapshot",
    dataset: "marts",
    table: "app_location_snapshot",
  },
  {
    logicalName: "latest_weather_by_location",
    canonicalKey: "marts.latest_weather_by_location",
    dataset: "marts",
    table: "latest_weather_by_location",
  },
] as const;

function isGsUri(value: string) {
  return value.startsWith("gs://");
}

function normalizeGsUri(value: string) {
  const normalizedValue = value.trim();

  if (!isGsUri(normalizedValue)) {
    throw new AgroExportResolutionError(
      `Invalid shard path \"${value}\". Runtime resolution only supports gs:// URIs from gcs_objects.`,
    );
  }

  return normalizedValue;
}

function getAllowedExportDefinition(logicalName: LogicalTableName) {
  const definition = allowedExportDefinitions.find((entry) => entry.logicalName === logicalName);

  if (!definition) {
    throw new AgroExportResolutionError(`No export definition registered for logical table \"${logicalName}\".`);
  }

  return definition;
}

export function listAllowedExportDefinitions() {
  return [...allowedExportDefinitions];
}

export function listPreferredSnapshotExportDefinitions() {
  return [...preferredSnapshotExportDefinitions];
}

export function listAvailableManifestExports(manifest: ExportManifest): AvailableManifestExport[] {
  return manifest.exports
    .map((entry) => ({
      canonicalKey: `${entry.dataset}.${entry.table}`,
      dataset: entry.dataset,
      fullyQualified: entry.fully_qualified,
      shardCount: entry.gcs_objects.length,
      table: entry.table,
      tableType: entry.table_type ?? null,
    }))
    .toSorted((left, right) => left.canonicalKey.localeCompare(right.canonicalKey));
}

export function resolveLogicalExportFromManifest(
  manifest: ExportManifest,
  logicalName: LogicalTableName,
): ResolvedExport {
  const definition = getAllowedExportDefinition(logicalName);

  const matchingExports = manifest.exports.filter(
    (entry) => entry.dataset === definition.dataset && entry.table === definition.table,
  );

  if (matchingExports.length === 0) {
    throw new AgroExportResolutionError(
      `Missing required export \"${definition.canonicalKey}\" for logical table \"${logicalName}\".`,
    );
  }

  if (matchingExports.length > 1) {
    throw new AgroExportResolutionError(
      `Logical table \"${logicalName}\" resolved to multiple exports for canonical key \"${definition.canonicalKey}\".`,
    );
  }

  const [matchingExport] = matchingExports;
  const shardPaths = Array.from(new Set(matchingExport.gcs_objects.map(normalizeGsUri))).toSorted((left, right) =>
    left.localeCompare(right),
  );

  if (shardPaths.length === 0) {
    throw new AgroExportResolutionError(
      `Export \"${definition.canonicalKey}\" does not contain any canonical gs:// shard paths.`,
    );
  }

  return {
    ...definition,
    fullyQualified: matchingExport.fully_qualified,
    generatedAt: manifest.generated_at,
    shardCount: shardPaths.length,
    shardPaths,
  };
}

export function listResolvedExportsFromManifest(manifest: ExportManifest) {
  return allowedExportDefinitions.map((definition) => resolveLogicalExportFromManifest(manifest, definition.logicalName));
}

export function resolvePreferredSnapshotExportFromManifest(
  manifest: ExportManifest,
): ResolvedPreferredSnapshotExport | null {
  for (const definition of preferredSnapshotExportDefinitions) {
    const matchingExports = manifest.exports.filter(
      (entry) => entry.dataset === definition.dataset && entry.table === definition.table,
    );

    if (matchingExports.length === 0) {
      continue;
    }

    if (matchingExports.length > 1) {
      throw new AgroExportResolutionError(
        `Preferred snapshot export \"${definition.canonicalKey}\" resolved to multiple manifest entries.`,
      );
    }

    const [matchingExport] = matchingExports;
    const shardPaths = Array.from(new Set(matchingExport.gcs_objects.map(normalizeGsUri))).toSorted((left, right) =>
      left.localeCompare(right),
    );

    if (shardPaths.length === 0) {
      throw new AgroExportResolutionError(
        `Preferred snapshot export \"${definition.canonicalKey}\" does not contain any canonical gs:// shard paths.`,
      );
    }

    return {
      ...definition,
      fullyQualified: matchingExport.fully_qualified,
      generatedAt: manifest.generated_at,
      shardCount: shardPaths.length,
      shardPaths,
    };
  }

  return null;
}
