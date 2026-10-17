"use client";

import { useRef, useState } from "react";
import { Check, FileText, Loader2, Upload, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

const ERRORS: Record<string, string> = {
  file_too_large: "Tệp lớn hơn 10 MB. Hãy chia nhỏ tài liệu hoặc dán phần cần dùng.",
  unsupported_file_type: "Chỉ nhận tệp Word (.docx), PDF, .txt hoặc .md.",
  no_text_in_file: "Không đọc được chữ trong tệp (có thể là PDF chụp ảnh). Hãy dán văn bản vào ô bên dưới.",
  convert_failed: "Không mở được tệp Word này. Hãy lưu lại bằng Word rồi thử lần nữa, hoặc dán văn bản.",
  source_too_short: "Tài liệu quá ngắn để lập dàn ý (cần ít nhất 200 ký tự).",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  no_token_budget: "Bạn đã dùng hết hạn mức AI. Dàn ý chưa được lập; bạn vẫn soạn tay được bằng ô Richtext editor.",
  forbidden: "Bạn không có quyền sửa khoá học này.",
  validation_failed: "Hãy chọn một tệp hoặc dán nội dung trước.",
};

const STAGES = ["Đọc tài liệu và tách đoạn", "AI đọc và lập dàn ý", "Tạo bản nháp"] as const;

/**
 * Bước 1: tải tệp hoặc dán văn bản. Gửi lên, đọc luồng tiến độ (NDJSON) cho tới
 * khi có bản nháp. Lập dàn ý chưa viết bài — giảng viên sửa và chốt ở bước 2.
 */
export default function SourceStep({
  lessonId,
  onDone,
}: {
  lessonId: string;
  onDone: (draftId: string, warnings: string[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = stage >= 0;

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    setError(null);
    setFile(f);
  }

  async function submit() {
    if (busy) return;
    setError(null);
    const fd = new FormData();
    if (file) fd.append("file", file);
    else if (text.trim()) fd.append("text", text);
    else {
      setError(ERRORS.validation_failed!);
      return;
    }
    setStage(0);
    try {
      const res = await fetch(apiUrl(`/api/lessons/${lessonId}/drafts`), { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `http_${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { type: string; stage?: string; draftId?: string; warnings?: string[]; error?: string };
          if (ev.type === "stage" && ev.stage === "outlining") setStage(1);
          if (ev.type === "error") throw new Error(ev.error ?? "generate_failed");
          if (ev.type === "done" && ev.draftId) {
            setStage(2);
            onDone(ev.draftId, ev.warnings ?? []);
            return;
          }
        }
      }
      throw new Error("generate_failed");
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      setError(ERRORS[code] ?? "AI chưa lập được dàn ý. Vui lòng thử lại sau ít phút.");
      setStage(-1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-h1">Biến tài liệu thành bài học</h1>
      <p className="mt-2 text-muted">
        AI đọc tài liệu và đề xuất dàn ý trước. Bạn sửa dàn ý, chốt lại, rồi AI mới viết bài — không có gì được đưa
        tới học viên cho tới khi bạn bấm Áp dụng.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        className={`mt-6 block cursor-pointer rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          drag ? "border-brand-500 bg-brand-soft" : "border-token bg-[rgb(var(--surface))] hover:border-brand-300"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.pdf,.txt,.md"
          className="sr-only"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand-700">
          <Upload className="h-5 w-5" aria-hidden />
        </span>
        <span className="block font-semibold">Kéo thả tệp vào đây hoặc bấm để chọn</span>
        <span className="text-caption mt-1 block text-faint">
          Word, PDF, .txt, .md · tối đa 10 MB · ảnh trong Word được giữ lại
        </span>
      </label>

      {file ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] px-3 py-2">
          <FileText className="h-5 w-5 text-brand-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-caption text-faint">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            disabled={busy}
            className="rounded p-1 text-faint hover:text-danger-600"
            aria-label="Bỏ tệp đã chọn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="text-caption my-4 flex items-center gap-3 text-faint">
            <span className="h-px flex-1 bg-[rgb(var(--border))]" />
            hoặc dán nội dung
            <span className="h-px flex-1 bg-[rgb(var(--border))]" />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={6}
            placeholder="Dán nội dung bài vào đây..."
            className="textarea w-full"
          />
        </>
      )}

      {error && <p className="banner-danger mt-4 text-sm">{error}</p>}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={submit} disabled={busy} className="btn-primary inline-flex items-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Đọc tài liệu và lập dàn ý
        </button>
      </div>

      {busy && (
        <ol className="mt-6 space-y-2 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4" aria-live="polite">
          {STAGES.map((label, i) => (
            <li key={label} className={`flex items-center gap-3 text-sm ${i <= stage ? "text-[rgb(var(--text))]" : "text-faint"}`}>
              <span
                className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
                  i < stage ? "border-brand-600 bg-brand-600 text-white" : i === stage ? "border-brand-600" : "border-token"
                }`}
              >
                {i < stage ? <Check className="h-3 w-3" /> : i === stage ? <Loader2 className="h-3 w-3 animate-spin text-brand-600" /> : null}
              </span>
              {label}
            </li>
          ))}
          <li className="text-caption pt-1 text-faint">Tài liệu dài có thể mất khoảng một phút.</li>
        </ol>
      )}
    </div>
  );
}
