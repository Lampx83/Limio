import { z } from "zod";

export const VideoPayload = z.object({
  url: z.string().url(),
  transcriptUrl: z.string().url().optional(),
  durationSec: z.number().int().positive().optional(),
});

export const MarkdownPayload = z.object({
  body: z.string().min(1).max(200_000),
});

export const EmbedPayload = z.object({
  url: z.string().url(),
  height: z.number().int().positive().optional(),
});

export const FilePayload = z.object({
  url: z.string().url(),
  filename: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(200).optional(),
});

export const ExternalLinkPayload = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
});

export const PdfPayload = z.object({
  url: z.string().url(),
  // Optional title shown above the embedded viewer.
  title: z.string().max(200).optional(),
  // Optional total page count — used for analytics later, not for rendering.
  totalPages: z.number().int().positive().optional(),
});

export const ScormPayload = z.object({
  packageId: z.string().uuid(),
  title: z.string().max(200).optional(),
  // Optional entry override — relative path inside the SCORM zip. Defaults to
  // the resource href in the manifest. Use to point at a specific page when
  // the manifest entry is a placeholder (e.g. CP samples).
  entryHref: z.string().max(500).optional(),
});

export const LtiPayload = z.object({
  toolId: z.string().uuid(),
  title: z.string().max(200).optional(),
  // Optional resource_link_id override — defaults to ContentItem.id at render time.
  resourceLinkId: z.string().max(200).optional(),
});

export const H5pPayload = z.object({
  packageId: z.string().uuid(),
  title: z.string().max(200).optional(),
});

const PAYLOAD_BY_TYPE = {
  video: VideoPayload,
  markdown: MarkdownPayload,
  embed: EmbedPayload,
  file: FilePayload,
  external_link: ExternalLinkPayload,
  pdf: PdfPayload,
  scorm: ScormPayload,
  lti: LtiPayload,
  h5p: H5pPayload,
} as const;

export type ContentTypeKey = keyof typeof PAYLOAD_BY_TYPE;

/** Validate that a payload matches the schema for its content type. */
export function validateContentPayload(
  type: ContentTypeKey,
  rawPayload: unknown,
): Record<string, unknown> {
  const schema = PAYLOAD_BY_TYPE[type];
  return schema.parse(rawPayload) as Record<string, unknown>;
}
