import "server-only";

import { existsSync } from "node:fs";

import type { StorageOptions } from "@google-cloud/storage";
import { z } from "zod";

import { getAgroEnv } from "@/lib/server/env";
import { AgroConfigError } from "@/lib/server/errors";

const serviceAccountSchema = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  project_id: z.string().optional(),
});

export type GoogleCredentialMode = "base64" | "keyFile";

export interface GoogleStorageClientConfig {
  credentialMode: GoogleCredentialMode;
  options: StorageOptions;
}

function parseServiceAccountFromBase64(encodedValue: string) {
  let parsedValue: unknown;

  try {
    const jsonValue = Buffer.from(encodedValue, "base64").toString("utf8");
    parsedValue = JSON.parse(jsonValue);
  } catch (error) {
    throw new AgroConfigError(
      "AGRO_GCP_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64-encoded JSON.",
      { cause: error },
    );
  }

  const parsedServiceAccount = serviceAccountSchema.safeParse(parsedValue);

  if (!parsedServiceAccount.success) {
    const details = parsedServiceAccount.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new AgroConfigError(`Invalid service account JSON in AGRO_GCP_SERVICE_ACCOUNT_JSON_BASE64. ${details}`);
  }

  return parsedServiceAccount.data;
}

export function getGoogleStorageClientConfig(): GoogleStorageClientConfig {
  const env = getAgroEnv();

  if (env.AGRO_GCP_SERVICE_ACCOUNT_JSON_BASE64) {
    const serviceAccount = parseServiceAccountFromBase64(env.AGRO_GCP_SERVICE_ACCOUNT_JSON_BASE64);

    return {
      credentialMode: "base64",
      options: {
        projectId: env.GCP_PROJECT_ID,
        credentials: {
          client_email: serviceAccount.client_email,
          private_key: serviceAccount.private_key,
        },
      },
    };
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (!existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
      throw new AgroConfigError(
        `GOOGLE_APPLICATION_CREDENTIALS does not point to an existing file: ${env.GOOGLE_APPLICATION_CREDENTIALS}`,
      );
    }

    return {
      credentialMode: "keyFile",
      options: {
        projectId: env.GCP_PROJECT_ID,
        keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS,
      },
    };
  }

  throw new AgroConfigError(
    "Missing GCS credentials. Set AGRO_GCP_SERVICE_ACCOUNT_JSON_BASE64 for serverless deployments or GOOGLE_APPLICATION_CREDENTIALS for local development.",
  );
}
