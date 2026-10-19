"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { describeImportRow, parseManifestText } from "@/lib/libraryTable";

interface Row {
  index: number;
  title: string;
  status: string;
  errors: string[];
}
interface Result {
  results: Row[];
  summary: { total: number; created: number; wouldCreate: number; skipped: number; failed: number };
}

/**
 * LANG L6.8 — nhập hàng loạt đề từ file JSON: xem trước báo lỗi theo dòng (không ghi gì), rồi mới tạo. Đề tạo ở trạng
 * thái NHÁP (tuỳ chọn xuất bản ngay); chạy lại không tạo trùng. Audio là file đã tải lên hệ thống.
 */
export default function ImportPanel({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [skill, setSkill] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(Result & { dry: boolean }) | null>(null);

  async function run(dryRun: boolean) {
    setError(null);
    const parsed = parseManifestText(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/exams-import`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manifest: parsed.manifest, dryRun, publish, ...(skill ? { defaultSkill: skill } : {}) }),
      });
      const j = (await r.json().catch(() => null)) as (Result & { error?: string }) | null;
      if (!r.ok || !j?.results) {
        setError(j?.error === "validation_failed" ? "File chưa đúng khuôn (xem hướng dẫn bên dưới)." : "Không nhập được. Vui lòng thử lại.");
        return;
      }
      setResult({ ...j, dry: dryRun });
      if (!dryRun) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" aria-label="Nhập hàng loạt" data-testid="import-panel">
      <h2 className="text-h3">Nhập hàng loạt</h2>
      <p className="text-meta mt-1">
        Chọn file JSON (mảng <code>exams</code>, mỗi đề có tiêu đề, kỹ năng, bộ, nguồn, bài đọc và câu hỏi). Bấm <b>Kiểm tra</b> để xem
        từng đề có lỗi gì trước khi tạo; đề tạo ra ở trạng thái <b>nháp</b>.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Chọn file JSON"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
            e.target.value = "";
            setResult(null);
          }}
        />
        <label className="flex items-center gap-1.5">
          Kỹ năng mặc định
          <select className="select" value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">— theo từng đề —</option>
            <option value="listening">Nghe</option>
            <option value="reading">Đọc</option>
            <option value="writing">Viết</option>
            <option value="speaking">Nói</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Xuất bản ngay đề hợp lệ
        </label>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={5}
        className="textarea mt-3 w-full font-mono text-xs"
        placeholder='{"exams":[{"title":"Đề 1","skill":"listening","collection":"Phần 1","seq":1,"sourceLabel":"HSK 2023-05","questions":[{"type":"mcq","prompt":"…","options":[{"label":"A","correct":true},{"label":"B"}]}]}]}'
        aria-label="Nội dung manifest"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => void run(true)} disabled={busy || !text.trim()}>
          Kiểm tra
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => void run(false)} disabled={busy || !text.trim()}>
          {busy ? "Đang xử lý…" : "Tạo các đề"}
        </button>
      </div>
      {error && <p role="alert" className="banner-danger mt-3 text-sm">{error}</p>}
      {result && (
        <div className="mt-4" role="status" aria-live="polite">
          <p className="text-sm font-medium">
            {result.dry ? "Kết quả kiểm tra" : "Kết quả nhập"}: {result.summary.total} đề — {result.dry ? `sẽ tạo ${result.summary.wouldCreate}` : `đã tạo ${result.summary.created}`}, bỏ qua trùng {result.summary.skipped}, lỗi {result.summary.failed}.
          </p>
          <ul className="mt-2 max-h-64 divide-y divide-[rgb(var(--border))] overflow-y-auto rounded-lg border border-token text-sm">
            {result.results.map((r) => (
              <li key={r.index} className="px-3 py-2">
                <span className={r.status === "error" ? "font-semibold text-danger-700" : r.status === "skipped_duplicate" ? "text-muted" : ""}>
                  {r.title} — {describeImportRow(r.status)}
                </span>
                {r.errors.map((e) => (
                  <div key={e} className="text-xs text-danger-700">{e}</div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
