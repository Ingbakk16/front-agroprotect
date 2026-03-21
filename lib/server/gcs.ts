import "server-only";

import { Storage } from "@google-cloud/storage";

import { getGoogleStorageClientConfig, type GoogleCredentialMode } from "@/lib/server/google-auth";

let cachedClient: Storage | null = null;
let cachedCredentialMode: GoogleCredentialMode | null = null;

export function getGcsClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const { credentialMode, options } = getGoogleStorageClientConfig();
  cachedClient = new Storage(options);
  cachedCredentialMode = credentialMode;

  return cachedClient;
}

export function getGcsCredentialMode() {
  if (cachedCredentialMode) {
    return cachedCredentialMode;
  }

  const { credentialMode } = getGoogleStorageClientConfig();
  cachedCredentialMode = credentialMode;

  return cachedCredentialMode;
}
