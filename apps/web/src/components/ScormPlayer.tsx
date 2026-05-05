"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface AttemptInit {
  attemptId: string;
  lessonStatus: string;
  suspendData: string | null;
  location: string | null;
  scoreRaw: number | null;
  totalTime: string | null;
}

interface PackageMeta {
  id: string;
  entryHref: string;
  version: string;
}

/**
 * SCORM 1.2 player. Mounts a Scorm12API on `window.API` BEFORE the iframe
 * loads (per spec — content searches up the window chain). Commits CMI on
 * every LMSCommit, plus on LMSFinish + window unload.
 */
export default function ScormPlayer({
  packageId,
  entryHref: entryHrefProp,
  courseId,
  lessonId,
}: {
  packageId: string;
  entryHref?: string;
  courseId?: string;
  lessonId?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiInstalledRef = useRef(false);
  const [status, setStatus] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attemptId: string | null = null;
    let scormApi: { LMSFinish?: (s: string) => void } | null = null;

    async function init() {
      // Resolve entryHref + version from package list.
      let entryHref = entryHrefProp;
      let version = "1.2";
      const pkgRes = await fetch(apiUrl("/api/scorm-packages");
      if (pkgRes.ok) {
        const data = (await pkgRes.json()) as { packages: PackageMeta[] };
        const found = data.packages.find((p) => p.id === packageId);
        if (found) {
          entryHref = entryHref ?? found.entryHref;
          version = found.version;
        }
      }
      if (!entryHref) {
        // Fall back to letting the package's index.html resolve. SCORM
        // best-practice puts launcher at root.
        entryHref = "index.html";
      }

      // 1. Open/resume attempt to load CMI state.
      const attemptRes = await fetch(apiUrl("/api/scorm-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          courseId: courseId ?? null,
          lessonId: lessonId ?? null,
        }),
      });
      if (!attemptRes.ok) {
        const details = await attemptRes.text().catch(() => "");
        console.error("SCORM attempt init failed:", attemptRes.status, details);
        setError(`attempt_init_failed_${attemptRes.status}`);
        return;
      }
      const a = (await attemptRes.json()) as AttemptInit;
      if (cancelled) return;
      attemptId = a.attemptId;

      // 2. Dynamic-import scorm-again on the client only. Pick API class by version.
      let mod;
      try {
        mod = await import("scorm-again");
      } catch (e) {
        console.error("Failed to import scorm-again:", e);
        setError("scorm_lib_import_failed");
        return;
      }
      const ApiClass = (
        version === "2004"
          ? (mod as unknown as { Scorm2004API: new (settings: unknown) => unknown })
              .Scorm2004API
          : (mod as unknown as { Scorm12API: new (settings: unknown) => unknown })
              .Scorm12API
      );
      if (!ApiClass) {
        console.error(`ScormAPI class not found for version ${version}`);
        setError("scorm_api_load_failed");
        return;
      }

      // 3. Install API on window. SCORM 1.2 content reads window.API; SCORM
      // 2004 reads window.API_1484_11. We set both keys for safety.
      const cmiInit =
        version === "2004"
          ? {
              completion_status: a.lessonStatus,
              score: { raw: a.scoreRaw ?? "" },
              total_time: a.totalTime ?? "PT0H0M0S",
              location: a.location ?? "",
              suspend_data: a.suspendData ?? "",
            }
          : {
              core: {
                lesson_status: a.lessonStatus,
                score: { raw: a.scoreRaw ?? "" },
                total_time: a.totalTime ?? "0000:00:00",
                lesson_location: a.location ?? "",
              },
              suspend_data: a.suspendData ?? "",
            };

      const api = new ApiClass({
        autocommit: true,
        autocommitSeconds: 30,
        logLevel: 4,
        cmi: cmiInit,
      }) as Record<string, unknown>;

      // Hook commit / finish to our endpoint.
      const commit = async () => {
        if (!attemptId) return;
        const get = (api.lmsGetValue ?? api.GetValue) as
          | ((k: string) => string)
          | undefined;
        const safeGet = (k: string) => {
          try {
            return get ? get(k) : "";
          } catch {
            return "";
          }
        };
        // Field paths differ between 1.2 and 2004.
        const isV2004 = version === "2004";
        const scoreRawStr = safeGet(isV2004 ? "cmi.score.raw" : "cmi.core.score.raw");
        const scoreRaw = scoreRawStr ? Number(scoreRawStr) : null;
        const lessonStatus = isV2004
          ? safeGet("cmi.success_status") ||
            safeGet("cmi.completion_status") ||
            undefined
          : safeGet("cmi.core.lesson_status") || undefined;
        const completionStatus = safeGet("cmi.completion_status") || undefined;
        const suspendData = safeGet("cmi.suspend_data");
        const location = safeGet(isV2004 ? "cmi.location" : "cmi.core.lesson_location");
        const totalTime =
          safeGet(isV2004 ? "cmi.total_time" : "cmi.core.total_time") || undefined;
        await fetch(apiUrl(`/api/scorm-attempts/${attemptId}/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonStatus,
            completionStatus,
            scoreRaw: Number.isFinite(scoreRaw) ? scoreRaw : null,
            suspendData: suspendData || null,
            location: location || null,
            totalTime,
          }),
        });
        if (lessonStatus) setStatus(lessonStatus);
      };

      // Wrap the API's commit + finish methods to fan out to our endpoint.
      // scorm-again's `on` event system is unreliable across versions, so we
      // monkey-patch the public methods. We keep originals for behavior parity.
      const apiAny = api as Record<string, unknown>;
      const commitKey = version === "2004" ? "Commit" : "LMSCommit";
      const finishKey = version === "2004" ? "Terminate" : "LMSFinish";
      const origCommit = apiAny[commitKey] as ((s: string) => string) | undefined;
      const origFinish = apiAny[finishKey] as ((s: string) => string) | undefined;
      if (typeof origCommit === "function") {
        apiAny[commitKey] = function (this: unknown, s: string) {
          const r = origCommit.call(this, s);
          void commit();
          return r;
        };
      }
      if (typeof origFinish === "function") {
        apiAny[finishKey] = async function (this: unknown, s: string) {
          const r = origFinish.call(this, s);
          await commit();
          if (attemptId) {
            await fetch(apiUrl(`/api/scorm-attempts/${attemptId}/commit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ finished: true }),
            });
          }
          return r;
        };
      }

      // 1.2 uses window.API, 2004 uses window.API_1484_11. Set both — harmless.
      if (version === "2004") {
        (window as unknown as { API_1484_11: unknown }).API_1484_11 = api;
      }
      (window as unknown as { API: unknown }).API = api;
      scormApi = api as typeof scormApi;
      apiInstalledRef.current = true;

      // 4. Now load the iframe (after API is ready).
      if (iframeRef.current) {
        const src = `/api/scorm-packages/${packageId}/files/${entryHref}`;
        console.log("Loading SCORM iframe:", src);
        iframeRef.current.src = src;
        iframeRef.current.onload = () => console.log("SCORM iframe loaded successfully");
        iframeRef.current.onerror = () => console.error("SCORM iframe failed to load");
      }
      setStatus(a.lessonStatus);
    }

    void init();

    const onUnload = () => {
      try {
        const finish = (
          scormApi as { LMSFinish?: (s: string) => void; Terminate?: (s: string) => void } | null
        );
        finish?.LMSFinish?.("") ?? finish?.Terminate?.("");
      } catch {
        // best-effort
      }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onUnload);
      try {
        const finish = (
          scormApi as { LMSFinish?: (s: string) => void; Terminate?: (s: string) => void } | null
        );
        finish?.LMSFinish?.("") ?? finish?.Terminate?.("");
      } catch {
        // ignore
      }
      const w = window as unknown as {
        API?: unknown;
        API_1484_11?: unknown;
      };
      try {
        delete w.API;
        delete w.API_1484_11;
      } catch {
        w.API = undefined;
        w.API_1484_11 = undefined;
      }
      apiInstalledRef.current = false;
    };
  }, [packageId, entryHrefProp, courseId, lessonId]);

  if (error) {
    const errorMessages: Record<string, string> = {
      attempt_init_failed_401: "Chưa đăng nhập",
      attempt_init_failed_403: "Không có quyền truy cập",
      attempt_init_failed: "Không thể tạo phiên làm bài",
      scorm_lib_import_failed: "Không thể tải thư viện SCORM",
      scorm_api_load_failed: "Không thể khởi tạo SCORM API",
    };
    const msg = errorMessages[error] || `Lỗi: ${error}`;
    return (
      <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-700">
        ⚠️ {msg}. Hãy tải lại trang hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp tục.
      </div>
    );
  }

  const isComplete =
    status === "completed" || status === "passed" || status === "succeeded";
  const isLoading = status === "loading";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-faint">SCORM 1.2</span>
        <span className={isComplete ? "chip-success" : isLoading ? "chip" : "chip"}>
          {isLoading ? "⏳ Đang tải..." : status}
        </span>
      </div>
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/50 backdrop-blur-sm">
            <div className="text-center">
              <div className="animate-spin mb-2">⚙️</div>
              <p className="text-xs text-muted">Đang khởi tạo...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="SCORM content"
          className="h-[80vh] w-full overflow-hidden rounded-xl border border-token bg-white shadow-card"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
