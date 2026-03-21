import "server-only";

import { createInterface } from "node:readline";

import type { ZodSchema } from "zod";

import { AgroDataError, AgroNdjsonError } from "@/lib/server/errors";
import { getGcsClient } from "@/lib/server/gcs";

export interface ParsedGsUri {
  bucket: string;
  objectPath: string;
}

export interface NdjsonRowContext {
  gsUri: string;
  lineNumber: number;
}

export type NdjsonRowParser<T> = (rawValue: unknown, context: NdjsonRowContext) => T;

function formatIssuesPath(path: Array<string | number>) {
  return path.length === 0 ? "<root>" : path.join(".");
}

export function parseGsUri(gsUri: string): ParsedGsUri {
  let parsedUri: URL;

  try {
    parsedUri = new URL(gsUri);
  } catch (error) {
    throw new AgroDataError(`Invalid GCS URI: ${gsUri}`, { cause: error });
  }

  if (parsedUri.protocol !== "gs:") {
    throw new AgroDataError(`Invalid GCS URI protocol for ${gsUri}. Expected gs://.`);
  }

  const bucket = parsedUri.hostname;
  const objectPath = parsedUri.pathname.replace(/^\/+/, "");

  if (!bucket || !objectPath) {
    throw new AgroDataError(`Invalid GCS URI: ${gsUri}`);
  }

  return { bucket, objectPath };
}

export function parseNdjsonWithSchema<T>(schema: ZodSchema<T>, rawValue: unknown, context: NdjsonRowContext): T {
  const parsedValue = schema.safeParse(rawValue);

  if (!parsedValue.success) {
    const details = parsedValue.error.issues
      .map((issue) => `${formatIssuesPath(issue.path)}: ${issue.message}`)
      .join("; ");

    throw new AgroNdjsonError(
      `Invalid NDJSON row in ${context.gsUri}:${context.lineNumber}. ${details}`,
    );
  }

  return parsedValue.data;
}

export async function* streamNdjsonShard<T>(
  gsUri: string,
  parseRow: NdjsonRowParser<T>,
): AsyncGenerator<T, void, void> {
  const { bucket, objectPath } = parseGsUri(gsUri);
  const stream = getGcsClient().bucket(bucket).file(objectPath).createReadStream();
  const reader = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  try {
    for await (const line of reader) {
      lineNumber += 1;

      if (!line.trim()) {
        continue;
      }

      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(line);
      } catch (error) {
        throw new AgroNdjsonError(`Invalid JSON in ${gsUri}:${lineNumber}.`, { cause: error });
      }

      yield parseRow(parsedJson, { gsUri, lineNumber });
    }
  } catch (error) {
    if (error instanceof AgroDataError || error instanceof AgroNdjsonError) {
      throw error;
    }

    throw new AgroNdjsonError(`Failed to read NDJSON shard ${gsUri}.`, { cause: error });
  } finally {
    reader.close();
    stream.destroy();
  }
}

export async function* streamNdjsonShards<T>(
  gsUris: string[],
  parseRow: NdjsonRowParser<T>,
): AsyncGenerator<T, void, void> {
  for (const gsUri of gsUris) {
    yield* streamNdjsonShard(gsUri, parseRow);
  }
}

export async function readNdjsonShard<T>(gsUri: string, parseRow: NdjsonRowParser<T>): Promise<T[]> {
  const rows: T[] = [];

  for await (const row of streamNdjsonShard(gsUri, parseRow)) {
    rows.push(row);
  }

  return rows;
}

export async function readNdjsonShards<T>(gsUris: string[], parseRow: NdjsonRowParser<T>): Promise<T[]> {
  const rows: T[] = [];

  for await (const row of streamNdjsonShards(gsUris, parseRow)) {
    rows.push(row);
  }

  return rows;
}
