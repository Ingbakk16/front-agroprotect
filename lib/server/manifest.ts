import "server-only";

import { z } from "zod";

import { getAgroEnv } from "@/lib/server/env";
import { AgroGcsError, AgroManifestError } from "@/lib/server/errors";
import { getGcsClient, getGcsCredentialMode } from "@/lib/server/gcs";

const nonEmptyString = z.string().trim().min(1);

const optionalNonEmptyString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length === 0 ? undefined : trimmedValue;
  },
  nonEmptyString.optional(),
);

const manifestExportSchema = z
  .object({
    dataset: nonEmptyString,
    table: nonEmptyString,
    table_type: optionalNonEmptyString,
    export_method: optionalNonEmptyString,
    fully_qualified: nonEmptyString,
    bq_job_location: optionalNonEmptyString,
    gcs_objects: z.array(nonEmptyString).min(1),
    signed_urls: z.array(nonEmptyString).optional(),
  })
  .passthrough();

const exportManifestSchema = z
  .object({
    generated_at: nonEmptyString,
    project: z.unknown().optional(),
    gcs_bucket: optionalNonEmptyString,
    gcs_prefix: optionalNonEmptyString,
    mode: optionalNonEmptyString,
    exports: z.array(manifestExportSchema),
    dbt_manifest: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type ManifestExport = z.infer<typeof manifestExportSchema>;
export type ExportManifest = z.infer<typeof exportManifestSchema>;

export interface ManifestSummary {
  exportCount: number;
  exportsByDataset: Record<string, number>;
  topLevelKeys: string[];
}

export interface ExportManifestDiagnostics extends ManifestSummary {
  bucket: string;
  credentialMode: ReturnType<typeof getGcsCredentialMode>;
  fetchedAt: string;
  manifestGeneratedAt: string;
  manifestObject: string;
  manifestPath: string;
  prefix: string;
  projectId: string;
  rawBytes: number;
}

export interface ParsedExportManifest {
  manifest: ExportManifest;
  rawBytes: number;
}

function normalizePathSegment(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function getManifestObjectPath() {
  const env = getAgroEnv();
  return [env.AGRO_EXPORT_GCS_PREFIX, env.AGRO_EXPORT_MANIFEST_OBJECT]
    .map(normalizePathSegment)
    .filter(Boolean)
    .join("/");
}

export function getManifestPath() {
  const env = getAgroEnv();
  return `gs://${env.AGRO_EXPORT_GCS_BUCKET}/${getManifestObjectPath()}`;
}

export async function readExportManifestRaw() {
  const env = getAgroEnv();
  const objectPath = getManifestObjectPath();

  try {
    const [buffer] = await getGcsClient()
      .bucket(env.AGRO_EXPORT_GCS_BUCKET)
      .file(objectPath)
      .download();

    return {
      raw: buffer.toString("utf8"),
      rawBytes: buffer.byteLength,
    };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : undefined;
    const statusCode = code === 403 || code === 404 ? code : 500;
    const message =
      statusCode === 403
        ? `Access denied while reading ${getManifestPath()}. Check that the configured service account can read the exports bucket.`
        : statusCode === 404
          ? `Manifest not found at ${getManifestPath()}. Check AGRO_EXPORT_GCS_BUCKET, AGRO_EXPORT_GCS_PREFIX, and AGRO_EXPORT_MANIFEST_OBJECT.`
          : `Failed to read export manifest from ${getManifestPath()}.`;

    throw new AgroGcsError(message, statusCode, { cause: error });
  }
}

export function parseExportManifest(rawManifest: string) {
  let parsedManifest: unknown;

  try {
    parsedManifest = JSON.parse(rawManifest);
  } catch (error) {
    throw new AgroManifestError("The export manifest is not valid JSON.", { cause: error });
  }

  const parsedExportManifest = exportManifestSchema.safeParse(parsedManifest);

  if (!parsedExportManifest.success) {
    const details = parsedExportManifest.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new AgroManifestError(`The export manifest does not match the expected runtime contract. ${details}`);
  }

  return parsedExportManifest.data;
}

export async function getExportManifest() {
  const { manifest } = await readParsedExportManifest();
  return manifest;
}

export async function readParsedExportManifest(): Promise<ParsedExportManifest> {
  const { raw, rawBytes } = await readExportManifestRaw();

  return {
    manifest: parseExportManifest(raw),
    rawBytes,
  };
}

export function summarizeManifest(manifest: ExportManifest): ManifestSummary {
  const exportsByDataset = manifest.exports.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.dataset] = (counts[entry.dataset] ?? 0) + 1;
    return counts;
  }, {});

  return {
    exportCount: manifest.exports.length,
    exportsByDataset,
    topLevelKeys: Object.keys(manifest).sort(),
  };
}

export function buildExportManifestDiagnostics(
  manifest: ExportManifest,
  rawBytes: number,
): ExportManifestDiagnostics {
  const env = getAgroEnv();
  const summary = summarizeManifest(manifest);

  return {
    ...summary,
    bucket: env.AGRO_EXPORT_GCS_BUCKET,
    credentialMode: getGcsCredentialMode(),
    fetchedAt: new Date().toISOString(),
    manifestGeneratedAt: manifest.generated_at,
    manifestObject: env.AGRO_EXPORT_MANIFEST_OBJECT,
    manifestPath: getManifestPath(),
    prefix: env.AGRO_EXPORT_GCS_PREFIX,
    projectId: env.GCP_PROJECT_ID,
    rawBytes,
  };
}

export async function getExportManifestDiagnostics(): Promise<ExportManifestDiagnostics> {
  const { manifest, rawBytes } = await readParsedExportManifest();
  return buildExportManifestDiagnostics(manifest, rawBytes);
}
