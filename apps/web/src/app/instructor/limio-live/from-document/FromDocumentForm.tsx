"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { DURATIONS } from "@/lib/limioLiveOutline";

const MAX_MB = 10;

const ERROR_TEXT: Record<string, string> = {
  file_too_large: `Tệp lớn hơn ${MAX_MB} MB. Hãy chọn tệp nhỏ hơn hoặc dán phần văn bản cần dùng.`,
  unsupported_file_type: "Chỉ nhận tệp Word (.docx), PDF, văn bản (.txt) hoặc Markdown (.md).",
  no_text_in_file: "Không đọc được chữ trong tệp này. Nếu là PDF scan từ ảnh thì cần bản có chữ chọn được; bạn cũng có thể dán văn bản vào ô bên dưới.",
  source_too_short: "Tài liệu quá ngắn để soạn bài giảng. Hãy dùng tài liệu có ít nhất vài đoạn văn.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Vui lòng thử lại vào ngày mai.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này.",
  empty_outline: "AI chưa soạn được dàn ý từ tài liệu này. Hãy thử lại hoặc dùng tài liệu khác.",
  openai_error: "AI đang bận hoặc gặp lỗi. Vui lòng thử lại sau ít phút.",
  json_parse_failed: "AI trả lời chưa đúng định dạng. Vui lòng thử lại.",
};

export default function FromDocumentForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const ready = mode === "file" ? !!file : text.trim().length > 0;

  const submit = async () => {
    setError(null);
    if (mode === "file" && file && file.size > MAX_MB * 1024 * 1024) return setError(ERROR_TEXT.file_too_large!);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("minutes", String(minutes));
      if (mode === "file" && file) fd.set("file", file);
      else fd.set("text", text);
      const res = await fetch(apiUrl("/api/instructor/limio-live/outline"), { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        // Lỗi kiểm tra đầu vào: JSON thường.
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(ERROR_TEXT[j?.error ?? ""] ?? "Không soạn được dàn ý. Vui lòng thử lại.");
        return;
      }
      // Phần gọi AI trả luồng NDJSON: ping (giữ kết nối) ... done | error.
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let deckId: string | null = null;
      let failed: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { type: string; deckId?: string; error?: string };
          if (ev.type === "done" && ev.deckId) deckId = ev.deckId;
          else if (ev.type === "error") failed = ev.error ?? "generate_failed";
        }
      }
      if (deckId) return router.push(`/instructor/limio-live/${deckId}/outline`);
      setError(ERROR_TEXT[failed ?? ""] ?? "Không soạn được dàn ý. Vui lòng thử lại.");
      return;
    } catch {
      setError("Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8">
      <div className="border-b border-token pb-6">
        <a href="/instructor/limio-live" className="text-sm text-muted hover:underline">
          Limio-Live
        </a>
        <h1 className="mt-1 text-2xl font-bold">Tạo bài giảng từ tài liệu</h1>
        <p className="mt-2 text-muted">
          Tải tài liệu Word, PDF hoặc văn bản lên. AI sẽ đề xuất dàn ý slide; bạn xem và sửa dàn ý trước, rồi mới tạo
          slide.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="src-h">
        <h2 id="src-h" className="text-lg font-semibold">
          1. Tài liệu
        </h2>
        <div className="inline-flex rounded-full border border-token p-0.5 text-sm" role="group" aria-label="Cách nhập tài liệu">
          {(["file", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 font-medium ${mode === m ? "bg-brand-600 text-white" : "text-muted"}`}
            >
              {m === "file" ? "Tải tệp lên" : "Dán văn bản"}
            </button>
          ))}
        </div>

        {mode === "file" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center ${
              drag ? "border-brand-500 bg-brand-50" : "border-token"
            }`}
          >
            {file ? (
              <>
                <FileText size={32} className="text-brand-700" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB</p>
              </>
            ) : (
              <>
                <UploadCloud size={32} className="text-muted" />
                <p className="font-medium">Kéo tệp vào đây hoặc bấm để chọn</p>
                <p className="text-sm text-muted">Word (.docx), PDF, văn bản (.txt), Markdown (.md); tối đa {MAX_MB} MB.</p>
              </>
            )}
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              {file ? "Chọn tệp khác" : "Chọn tệp"}
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".docx,.pdf,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Dán nội dung tài liệu vào đây..."
            className="input w-full text-sm"
            aria-label="Nội dung tài liệu"
          />
        )}
      </section>

      <section className="space-y-3" aria-labelledby="dur-h">
        <h2 id="dur-h" className="text-lg font-semibold">
          2. Thời lượng buổi giảng
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {DURATIONS.map((d) => (
            <label
              key={d.minutes}
              className={`cursor-pointer rounded-2xl border-2 p-4 ${minutes === d.minutes ? "border-brand-500 bg-brand-50" : "border-token"}`}
            >
              <input
                type="radio"
                name="minutes"
                className="sr-only"
                checked={minutes === d.minutes}
                onChange={() => setMinutes(d.minutes)}
              />
              <span className="block text-lg font-bold">{d.minutes} phút</span>
              <span className="text-sm text-muted">
                Khoảng {d.min} đến {d.max} slide
              </span>
            </label>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button type="button" className="btn-primary flex items-center gap-2" disabled={!ready || busy} onClick={submit}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? "Đang soạn dàn ý..." : "Soạn dàn ý"}
        </button>
        {busy && <p className="text-sm text-muted">AI đang đọc tài liệu, thường mất từ 20 đến 60 giây. Vui lòng không đóng trang.</p>}
      </div>
    </main>
  );
}
