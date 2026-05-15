/**
 * A7.8 — Block page rendered when a strict-proctoring exam is opened from a
 * non-SEB browser. Server component (no client state needed).
 *
 * The `seb://` link is an OS-registered protocol handler that Safe Exam Browser
 * installs on first launch. Clicking it (in a non-SEB browser) auto-launches
 * SEB and points it at the embedded URL. If SEB isn't installed yet, the
 * browser shows its standard "Open with..." prompt or silently fails — hence
 * the explicit download link beneath it.
 */

import Link from "next/link";

export default function SebBrowserPrompt({
  examTitle,
  targetUrl,
  configFileUrl,
}: {
  examTitle: string;
  /** The URL the candidate should land on once SEB launches. */
  targetUrl: string;
  /** Optional `.seb` config file (per-exam allowlist + ConfigKey). */
  configFileUrl?: string;
}) {
  // `seb://` swaps the scheme so SEB can pick it up; the path remains identical.
  const sebUrl = targetUrl.replace(/^https?:\/\//, "seb://");
  const sebsUrl = targetUrl.startsWith("https://")
    ? targetUrl.replace(/^https:\/\//, "sebs://")
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div
        data-testid="seb-prompt"
        className="rounded-xl border border-amber-300 bg-amber-50 p-6"
      >
        <h1 className="text-xl font-bold text-amber-900">
          🔒 Bài thi yêu cầu Safe Exam Browser
        </h1>
        <p className="mt-2 text-sm text-amber-900">
          <b>{examTitle}</b> đã được giảng viên cấu hình ở mức giám sát{" "}
          <code className="rounded bg-amber-100 px-1">strict</code>. Bạn phải
          mở bài thi trong Safe Exam Browser (SEB) — trình duyệt chuyên dụng
          khóa toàn màn hình, chặn alt-tab, chặn copy ra ngoài và xác thực
          với máy chủ.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Bước 1 — Cài SEB (nếu chưa có)
            </div>
            <Link
              href="https://safeexambrowser.org/download_en.html"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block rounded border border-amber-400 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
            >
              Tải Safe Exam Browser ↗
            </Link>
            <p className="mt-1 text-xs text-amber-800">
              Có bản Windows, macOS, iPad. Chưa có bản Android / Linux.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Bước 2 — Mở bài thi trong SEB
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <a
                href={sebUrl}
                className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                🚀 Mở trong SEB
              </a>
              {sebsUrl && (
                <a
                  href={sebsUrl}
                  className="rounded border border-amber-400 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
                >
                  🔐 Mở trong SEB (HTTPS)
                </a>
              )}
              {configFileUrl && (
                <Link
                  href={configFileUrl}
                  className="rounded border border-amber-400 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
                >
                  📄 Tải file .seb
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs text-amber-800">
              Nếu trình duyệt hiện hộp thoại &quot;Mở liên kết với Safe Exam
              Browser&quot;, chọn Mở. Nếu không có gì xảy ra, bạn chưa cài SEB
              hoặc cần khởi động lại máy.
            </p>
          </div>
        </div>

        <details className="mt-5 rounded border border-amber-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-medium text-amber-900">
            Tại sao phải dùng SEB?
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
            <li>Chặn alt-tab và mở app khác trong khi thi.</li>
            <li>Chặn copy / dán ra ngoài cửa sổ bài thi.</li>
            <li>Ẩn taskbar, vô hiệu hóa screenshot và phím tắt hệ thống.</li>
            <li>Xác thực với server qua hash (chống fake browser).</li>
          </ul>
        </details>
      </div>
    </main>
  );
}
