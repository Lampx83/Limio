import { z } from "zod";

/**
 * URL or same-origin path. Accepts either:
 *   - an absolute http(s) URL (`https://example.com/foo`)
 *   - a same-origin absolute path (`/api/lesson-media/videos/abc.mp4`)
 *
 * Used for content payloads where the file may be either externally
 * hosted (YouTube, Vimeo, partner CDN) OR uploaded to our own
 * storage and served via a relative API route.
 *
 * Strict-URL fields (e.g. transcript URLs, external_link, embed) keep
 * `z.string().url()` since those are always external.
 */
export const UrlOrPath = z.string().refine(
  (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
  { message: "must be an absolute http(s) URL or same-origin path starting with /" },
);

/**
 * In-video cuepoint that gates further playback on a quiz pass. The
 * player pauses when `currentTime` first crosses `atSec`, shows the
 * referenced quiz's questions inline, and only resumes when the learner
 * answers all questions correctly. Forward-seeking past an unpassed
 * cuepoint is blocked.
 *
 * Only triggers for native <video> playback (uploaded files / direct
 * .mp4/.webm URLs). Provider-iframe videos (YouTube/Vimeo/Loom/...)
 * silently ignore cuepoints — pausing those would require each
 * provider's JS API.
 */
export const VideoCuepoint = z.object({
  atSec: z.number().nonnegative(),
  quizId: z.string().uuid(),
});

export const VideoPayload = z.object({
  url: UrlOrPath,
  transcriptUrl: z.string().url().optional(),
  durationSec: z.number().int().positive().optional(),
  cuepoints: z.array(VideoCuepoint).max(20).optional(),
});

export const MarkdownPayload = z.object({
  body: z.string().min(1).max(200_000),
});

/**
 * Rich-text content authored via WYSIWYG editor (Tiptap). Stored as HTML
 * string — server-side validation only enforces non-empty + length cap;
 * actual sanitization happens at render time via DOMPurify on the client.
 */
export const RichTextPayload = z.object({
  html: z.string().min(1).max(200_000),
});

export const EmbedPayload = z.object({
  url: z.string().url(),
  height: z.number().int().positive().optional(),
});

export const FilePayload = z.object({
  url: UrlOrPath,
  filename: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(200).optional(),
});

export const ExternalLinkPayload = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
});

export const PdfPayload = z.object({
  url: UrlOrPath,
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
  richtext: RichTextPayload,
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
