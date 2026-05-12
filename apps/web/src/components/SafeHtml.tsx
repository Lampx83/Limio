"use client";

import { useEffect, useState } from "react";

/**
 * Render instructor-authored HTML (richtext content) after sanitizing
 * with DOMPurify on the client. Server render is a hidden placeholder —
 * sanitization runs in useEffect so DOMPurify (which depends on the DOM)
 * never touches the server bundle.
 *
 * Strips scripts, event handlers, javascript: URLs, etc. — only safe
 * inline/block formatting tags + http(s)/mailto links survive.
 */
export default function SafeHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const [clean, setClean] = useState("");

  useEffect(() => {
    let active = true;
    void import("dompurify").then((mod) => {
      if (!active) return;
      const DOMPurify = mod.default;
      const sanitized = DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ["target", "rel", "style"],
        ADD_TAGS: ["mark"],
      });
      setClean(sanitized);
    });
    return () => {
      active = false;
    };
  }, [html]);

  return (
    <div
      className={className}
      // sanitized by DOMPurify in the effect above
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
