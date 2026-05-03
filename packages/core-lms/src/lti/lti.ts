import { randomUUID, randomBytes, generateKeyPairSync } from "node:crypto";
import { SignJWT, importPKCS8, exportJWK } from "jose";
import { prisma, type PrismaClient } from "@feedbackme/db";

export class LtiError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "tool_not_found"
      | "launch_not_found"
      | "forbidden",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/**
 * Public issuer URL for our platform. LTI tools receive this in the `iss`
 * claim and must use it to look up our JWKS. Override per-env.
 */
function platformIssuer(): string {
  return process.env.LTI_PLATFORM_ISSUER ?? "http://localhost:3000";
}

/** Generate an RSA-2048 keypair (PEM). Sync — only run once at registration. */
function generateRsaKeypair(): { privateKeyPem: string; publicKeyPem: string; kid: string } {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    // kid stable for the lifetime of this key.
    kid: randomUUID(),
  };
}

export interface RegisterToolInput {
  name: string;
  toolUrl: string;
  loginInitUrl: string;
  jwksUrl?: string | null;
  deploymentId?: string;
}

/** Register an external LTI 1.3 tool. Generates client_id + RSA keypair. */
export async function registerLtiTool(
  registeredById: string,
  input: RegisterToolInput,
  db: PrismaClient = prisma,
) {
  if (!input.name?.trim() || !input.toolUrl || !input.loginInitUrl) {
    throw new LtiError("validation_failed");
  }
  const { privateKeyPem, publicKeyPem, kid } = generateRsaKeypair();
  const clientId = `fbm-${randomBytes(8).toString("hex")}`;
  return db.ltiTool.create({
    data: {
      name: input.name.trim(),
      toolUrl: input.toolUrl,
      loginInitUrl: input.loginInitUrl,
      jwksUrl: input.jwksUrl ?? null,
      clientId,
      deploymentId: input.deploymentId ?? "1",
      privateKey: privateKeyPem,
      publicKeyKid: kid,
      publicKeyPem,
      registeredById,
    },
  });
}

export async function listLtiTools(db: PrismaClient = prisma) {
  return db.ltiTool.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      toolUrl: true,
      loginInitUrl: true,
      clientId: true,
      deploymentId: true,
      publicKeyKid: true,
      createdAt: true,
    },
  });
}

export async function deleteLtiTool(toolId: string, db: PrismaClient = prisma) {
  await db.ltiTool.delete({ where: { id: toolId } });
}

/**
 * JWKS — public-facing key set the tool fetches to verify our id_tokens.
 * Per spec exposed at /.well-known/jwks.json (or any URL the tool was given
 * during registration). Returns full JWKS with all active tools' public keys.
 */
export async function getPlatformJwks(db: PrismaClient = prisma) {
  const tools = await db.ltiTool.findMany({
    select: { publicKeyKid: true, publicKeyPem: true },
  });
  const keys = await Promise.all(
    tools.map(async (t) => {
      const { createPublicKey } = await import("node:crypto");
      const pubKey = createPublicKey(t.publicKeyPem);
      const jwk = pubKey.export({ format: "jwk" }) as Record<string, unknown>;
      return {
        ...jwk,
        kid: t.publicKeyKid,
        alg: "RS256",
        use: "sig",
      };
    }),
  );
  return { keys };
}

export interface OidcLoginInitInput {
  toolId: string;
  userId: string;
  resourceLinkId: string;
  courseId?: string | null;
  lessonId?: string | null;
  /** Page to return the learner to after launch — encoded into target_link_uri. */
  returnTo?: string;
}

/**
 * Step 1 of LTI 1.3 OIDC launch: redirect learner to tool's loginInitUrl with
 * iss + login_hint + target_link_uri. Tool then redirects back with state +
 * nonce; we hand back the signed id_token in step 2.
 */
export async function buildOidcLoginUrl(
  input: OidcLoginInitInput,
  db: PrismaClient = prisma,
): Promise<{ url: string }> {
  const tool = await db.ltiTool.findUnique({ where: { id: input.toolId } });
  if (!tool) throw new LtiError("tool_not_found");

  const params = new URLSearchParams({
    iss: platformIssuer(),
    login_hint: input.userId,
    target_link_uri: tool.toolUrl,
    client_id: tool.clientId,
    lti_deployment_id: tool.deploymentId,
    lti_message_hint: JSON.stringify({
      resourceLinkId: input.resourceLinkId,
      courseId: input.courseId ?? null,
      lessonId: input.lessonId ?? null,
    }),
  });
  return { url: `${tool.loginInitUrl}?${params.toString()}` };
}

export interface AuthRequestParams {
  /** Required by spec — echoed back. */
  state: string;
  /** Required by spec — echoed back, must be unique per request. */
  nonce: string;
  client_id: string;
  /** Tool's redirect_uri to receive id_token. */
  redirect_uri: string;
  login_hint: string;
  lti_message_hint?: string;
  scope?: string;
  response_type?: string;
  response_mode?: string;
  prompt?: string;
}

interface UserClaims {
  sub: string;
  name: string;
  email: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Step 2: tool redirects user back here with state + nonce. We mint a
 * signed id_token JWT and return it via auto-POST form (per OIDC implicit
 * flow). The tool verifies via our JWKS and starts its session.
 */
export async function mintIdToken(
  toolId: string,
  user: UserClaims,
  authParams: AuthRequestParams,
  context: { courseId?: string | null; lessonId?: string | null; resourceLinkId: string },
  db: PrismaClient = prisma,
): Promise<{ idToken: string; redirectUri: string; state: string }> {
  const tool = await db.ltiTool.findUnique({ where: { id: toolId } });
  if (!tool) throw new LtiError("tool_not_found");
  if (tool.clientId !== authParams.client_id) {
    throw new LtiError("validation_failed", "client_id_mismatch");
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000); // 5 min

  // Persist launch for anti-replay + audit.
  await db.ltiLaunch.create({
    data: {
      toolId,
      userId: user.sub,
      courseId: context.courseId ?? null,
      lessonId: context.lessonId ?? null,
      resourceLinkId: context.resourceLinkId,
      nonce: authParams.nonce,
      issuedAt,
      expiresAt,
    },
  });

  // Build id_token claims per LTI 1.3 + OIDC spec.
  const claims: Record<string, unknown> = {
    iss: platformIssuer(),
    sub: user.sub,
    aud: tool.clientId,
    exp: Math.floor(expiresAt.getTime() / 1000),
    iat: Math.floor(issuedAt.getTime() / 1000),
    nonce: authParams.nonce,
    name: user.name,
    email: user.email,
    given_name: user.given_name,
    family_name: user.family_name,
    // LTI 1.3 message claims.
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": tool.deploymentId,
    "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": tool.toolUrl,
    "https://purl.imsglobal.org/spec/lti/claim/resource_link": {
      id: context.resourceLinkId,
    },
    "https://purl.imsglobal.org/spec/lti/claim/roles": [
      "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
    ],
    ...(context.courseId && {
      "https://purl.imsglobal.org/spec/lti/claim/context": {
        id: context.courseId,
        type: ["http://purl.imsglobal.org/vocab/lis/v2/course#CourseSection"],
      },
    }),
  };

  const privateKey = await importPKCS8(tool.privateKey, "RS256");
  const idToken = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: tool.publicKeyKid, typ: "JWT" })
    .sign(privateKey);

  return { idToken, redirectUri: authParams.redirect_uri, state: authParams.state };
}

export { exportJWK };
