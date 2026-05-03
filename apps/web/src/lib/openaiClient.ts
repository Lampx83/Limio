import OpenAI from "openai";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";

/**
 * Resolve OpenAI client from saved IntegrationCredential or env fallback.
 * Throws "openai_not_configured" if neither is set.
 */
export async function getOpenaiClient(): Promise<OpenAI> {
  let key: string;
  try {
    key = await getIntegrationSecret("openai");
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      throw new Error("openai_not_configured");
    }
    throw e;
  }
  return new OpenAI({ apiKey: key });
}
