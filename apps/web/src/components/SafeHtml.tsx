"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

/**
 * Render instructor-authored HTML (richtext content) after sanitizing
 * with DOMPurify. Strips scripts, event handlers, javascript: URLs, etc.
 * — only safe inline/block formatting tags + http(s)/mailto links survive.
 */
export default function SafeHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ["target", "rel", "style"],
        ADD_TAGS: ["mark"],
      }),
    [html],
  );
  return (
    <div
      className={className}
      // sanitized by DOMPurify above
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
