import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";

/**
 * Cổng NEU API (Kong trên máy 232). Mọi route admin test NEU đi qua đây, để
 * sau này thêm API khác (không chỉ TTS) cùng dùng một base URL + key.
 */
export class NeuApiNotConfiguredError extends Error {}

async function optionalSecret(key: string): Promise<string | null> {
  return getIntegrationSecret(key).catch((e) => {
    if (e instanceof IntegrationError && e.code === "key_not_found") return null;
    throw e;
  });
}

export async function getNeuGateway(): Promise<{ baseUrl: string; apiKey: string }> {
  const [baseUrl, apiKey] = await Promise.all([
    optionalSecret("neutts.base_url"),
    optionalSecret("neutts.api_key"),
  ]);
  if (!baseUrl || !apiKey) throw new NeuApiNotConfiguredError("not_configured");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
