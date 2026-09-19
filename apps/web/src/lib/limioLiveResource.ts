import { validateContentPayload, type ContentTypeKey } from "@feedbackme/core-lms";

// Slide "Nội dung" chèn tài nguyên — tập con của ContentTypeKey (bỏ
// scorm/lti/h5p/teacher_note/video-cuepoint: không áp dụng cho 1 slide trình
// chiếu tuần tự, không theo dõi tiến độ học viên). Xem ResourceContent.tsx.
export const LIVE_SLIDE_RESOURCE_TYPES = [
  "richtext",
  "markdown",
  "video",
  "pdf",
  "file",
  "external_link",
  "embed",
  "html_block",
] as const satisfies readonly ContentTypeKey[];

export type LiveSlideResourceType = (typeof LIVE_SLIDE_RESOURCE_TYPES)[number];

/**
 * Validate a "content" slide's config server-side. Reuses
 * contentSchemas.ts's per-type payload validation (same shapes as
 * Lesson ContentItem) when `resource` is present — defense in depth on top
 * of the client-side form.
 */
export function validateContentSlideConfig(config: unknown): { error: string } | null {
  if (!config || typeof config !== "object") return null;
  const resource = (config as Record<string, unknown>).resource;
  if (resource === undefined || resource === null) return null;

  if (typeof resource !== "object") return { error: "invalid_resource" };
  const { type, payload } = resource as Record<string, unknown>;
  if (typeof type !== "string" || !LIVE_SLIDE_RESOURCE_TYPES.includes(type as LiveSlideResourceType)) {
    return { error: "invalid_resource_type" };
  }
  try {
    validateContentPayload(type as ContentTypeKey, payload);
    return null;
  } catch {
    return { error: "invalid_resource_payload" };
  }
}
