"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * H5P player. Uses h5p-standalone (frontend-only lib) to load the unzipped
 * package from our /api/h5p-packages/[id]/files/ endpoint. xAPI events emitted
 * by H5P content are captured via H5P.externalDispatcher and posted to our
 * /api/h5p-attempts/[id]/xapi endpoint.
 */
export default function H5pPlayer({
  packageId,
  title,
  courseId,
  lessonId,
}: {
  packageId: string;
  title?: string;
  courseId?: string;
  lessonId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoreText, setScoreText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attemptId: string | null = null;

    async function init() {
      // Open/resume attempt — pass lesson/course context so the bridge can
      // attribute xAPI events to the correct skill set + course for XP.
      const res = await fetch(apiUrl("/api/h5p-attempts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, courseId, lessonId }),
      });
      if (!res.ok) {
        setError("attempt_init_failed");
        return;
      }
      const a = (await res.json()) as { attemptId: string };
      if (cancelled) return;
      attemptId = a.attemptId;

      // Dynamic import so it stays client-side.
      const mod = await import("h5p-standalone");
      type H5PStandaloneCtor = new (
        el: HTMLElement,
        opts: Record<string, unknown>,
      ) => unknown;
      const H5PStandalone = (mod as unknown as { H5P: H5PStandaloneCtor }).H5P;

      if (!containerRef.current) return;
      try {
        await new H5PStandalone(containerRef.current, {
          h5pJsonPath: `/api/h5p-packages/${packageId}/files`,
          frameJs: "/h5p-vendor/frame.bundle.js",
          frameCss: "/h5p-vendor/styles/h5p.css",
          // Disable embed/copy buttons for in-LMS use.
          embedType: "iframe",
        });
      } catch (e) {
        setError(`h5p_init_failed: ${(e as Error).message ?? "unknown"}`);
        return;
      }

      // Capture xAPI events. H5P.externalDispatcher is set by the H5P framework
      // when content loads. We poll briefly until it appears.
      const tryHook = (attempts = 30) => {
        const w = window as unknown as {
          H5P?: {
            externalDispatcher?: {
              on: (evt: string, cb: (e: { data?: { statement?: unknown } }) => void) => void;
            };
          };
        };
        const disp = w.H5P?.externalDispatcher;
        if (!disp) {
          if (attempts > 0) setTimeout(() => tryHook(attempts - 1), 200);
          return;
        }
        disp.on("xAPI", async (event) => {
          if (!attemptId || cancelled) return;
          const stmt = event.data?.statement as
            | { verb?: { id?: string }; result?: { score?: { raw?: number; max?: number }; success?: boolean } }
            | undefined;
          if (!stmt) return;
          const verbId = stmt.verb?.id ?? "";
          const verb = verbId.split("/").pop() ?? verbId;
          const scoreRaw = stmt.result?.score?.raw ?? null;
          const scoreMax = stmt.result?.score?.max ?? null;
          const success = stmt.result?.success ?? null;
          if (scoreRaw !== null && scoreMax !== null) {
            setScoreText(`${scoreRaw} / ${scoreMax}`);
          }
          await fetch(apiUrl(`/api/h5p-attempts/${attemptId}/xapi`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ verb, scoreRaw, scoreMax, success }),
          });
        });
      };
      tryHook();
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [packageId, courseId, lessonId]);

  if (error) {
    return (
      <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-700">
        Lỗi tải H5P: {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        {title && (
          <p className="inline-flex items-center gap-2 text-sm font-medium text-muted">
            <span></span>
            {title}
          </p>
        )}
        {scoreText && (
          <span className="chip-success font-mono">{scoreText}</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="min-h-[200px] overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] shadow-card"
      />
    </div>
  );
}
