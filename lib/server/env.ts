import "server-only";

import { z } from "zod";

import { AgroConfigError } from "@/lib/server/errors";

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

const agroEnvSchema = z.object({
  GCP_PROJECT_ID: nonEmptyString,
  AGRO_DATA_SOURCE: z.enum(["mock", "gcs"]).default("mock"),
  AGRO_EXPORT_GCS_BUCKET: nonEmptyString,
  AGRO_EXPORT_GCS_PREFIX: nonEmptyString,
  AGRO_EXPORT_MANIFEST_OBJECT: nonEmptyString,
  GOOGLE_APPLICATION_CREDENTIALS: optionalNonEmptyString,
  AGRO_GCP_SERVICE_ACCOUNT_JSON_BASE64: optionalNonEmptyString,
});

export type AgroDataSource = z.infer<typeof agroEnvSchema>["AGRO_DATA_SOURCE"];

export interface AgroEnv extends z.infer<typeof agroEnvSchema> {
  AGRO_FALLBACK_TO_MOCK: boolean;
}

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off"]);

let cachedEnv: AgroEnv | null = null;

function parseBooleanEnv(key: string, value: string | undefined, defaultValue: boolean) {
  if (typeof value === "undefined" || value.trim().length === 0) {
    return defaultValue;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (TRUE_VALUES.has(normalizedValue)) {
    return true;
  }

  if (FALSE_VALUES.has(normalizedValue)) {
    return false;
  }

  throw new AgroConfigError(
    `Invalid boolean value for ${key}. Expected one of: ${[
      ...TRUE_VALUES,
      ...FALSE_VALUES,
    ].join(", ")}. Received: ${value}`,
  );
}

export function getAgroEnv(): AgroEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsedEnv = agroEnvSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    const details = parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new AgroConfigError(`Invalid AgroProtect environment configuration. ${details}`);
  }

  cachedEnv = {
    ...parsedEnv.data,
    AGRO_FALLBACK_TO_MOCK: parseBooleanEnv(
      "AGRO_FALLBACK_TO_MOCK",
      process.env.AGRO_FALLBACK_TO_MOCK,
      true,
    ),
  };

  return cachedEnv;
}
