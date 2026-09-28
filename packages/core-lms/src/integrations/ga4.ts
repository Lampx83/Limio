import { createSign } from "node:crypto";

interface Ga4ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Exchange a GA4 service-account JSON key for a short-lived OAuth2 access
 * token, via the JWT Bearer grant. No `googleapis`/`google-auth-library`
 * dependency — this is a handful of lines with node:crypto, and it's the only
 * Google API this codebase talks to.
 */
async function getGa4AccessToken(serviceAccountJson: string): Promise<string> {
  let sa: Ga4ServiceAccount;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("invalid_service_account_json");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("invalid_service_account_json");
  }

  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  signer.end();
  const signature = base64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`token_exchange_failed:${res.status}:${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("token_exchange_failed:no_access_token");
  return json.access_token;
}

/** Minimal shape of a GA4 Data API `runReport` response we actually read. */
interface Ga4RunReportResponse {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
}

async function runGa4Report(
  propertyId: string,
  serviceAccountJson: string,
  body: Record<string, unknown>,
): Promise<Ga4RunReportResponse> {
  const accessToken = await getGa4AccessToken(serviceAccountJson);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(errBody.error?.message ?? `ga4_http_${res.status}`);
  }
  return (await res.json()) as Ga4RunReportResponse;
}

/** Test a saved GA4 property ID + service account by running a tiny report. */
export async function testGa4Credential(
  propertyId: string,
  serviceAccountJson: string,
): Promise<{ ok: true; activeUsers7d: number } | { ok: false; error: string }> {
  if (!propertyId?.trim()) return { ok: false, error: "missing_property_id" };
  try {
    const report = await runGa4Report(propertyId.trim(), serviceAccountJson, {
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }],
    });
    const activeUsers7d = Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0);
    return { ok: true, activeUsers7d };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "unknown_error" };
  }
}

export interface Ga4Summary {
  activeUsers7d: number;
  sessions7d: number;
  newUsers7d: number;
  topPages: { path: string; views: number }[];
  channels: { channel: string; sessions: number }[];
}

/**
 * Dashboard summary — aggregate acquisition/engagement numbers only. Detailed
 * per-learner behaviour for research belongs to `LearningEvent`, not GA4 (see
 * CLAUDE.md §5.4 / §4.8): GA4 is a third-party processor with limited
 * retention, sampling, and no per-learner identity here.
 */
export async function getGa4Summary(
  propertyId: string,
  serviceAccountJson: string,
): Promise<Ga4Summary> {
  const [totals, pages, channels] = await Promise.all([
    runGa4Report(propertyId, serviceAccountJson, {
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "newUsers" }],
    }),
    runGa4Report(propertyId, serviceAccountJson, {
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 5,
    }),
    runGa4Report(propertyId, serviceAccountJson, {
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 5,
    }),
  ]);

  const totalsRow = totals.rows?.[0]?.metricValues ?? [];
  return {
    activeUsers7d: Number(totalsRow[0]?.value ?? 0),
    sessions7d: Number(totalsRow[1]?.value ?? 0),
    newUsers7d: Number(totalsRow[2]?.value ?? 0),
    topPages: (pages.rows ?? []).map((r) => ({
      path: r.dimensionValues?.[0]?.value ?? "",
      views: Number(r.metricValues?.[0]?.value ?? 0),
    })),
    channels: (channels.rows ?? []).map((r) => ({
      channel: r.dimensionValues?.[0]?.value ?? "",
      sessions: Number(r.metricValues?.[0]?.value ?? 0),
    })),
  };
}
