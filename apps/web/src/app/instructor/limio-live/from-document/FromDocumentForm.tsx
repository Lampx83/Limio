"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Pencil, Sparkles, UploadCloud } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { DURATIONS } from "@/lib/limioLiveOutline";

const MAX_MB = 10;
// Khớp TOPIC_MIN_CHARS / TOPIC_MAX_CHARS của core-feedback (máy chủ kiểm lại).
const TOPIC_MIN = 15;
const TOPIC_MAX = 2000;

const TOPIC_EXAMPLES = [
  {
    title: "Thực tế tăng cường trong lớp học",
    who: "cho sinh viên năm cuối Công nghệ giáo dục",
    text: "Bài giới thiệu về thực tế tăng cường (AR) trong lớp học cho sinh viên năm cuối ngành Công nghệ giáo dục. Sinh viên đã biết khái niệm đa phương tiện nhưng chưa từng làm sản phẩm AR. Sau buổi học, sinh viên phân biệt được AR với VR và đề xuất được một hoạt động học có dùng AR.",
  },
  {
    title: "Phân cấp thị giác trong thiết kế giao diện",
    who: "cho sinh viên năm hai học UI/UX",
    text: "Bài về nguyên lý phân cấp thị giác trong thiết kế giao diện cho sinh viên năm hai học môn Thiết kế UI/UX. Sinh viên đã dùng Figma ở mức cơ bản. Sau buổi học, sinh viên nhận ra được lỗi phân cấp trong một màn hình và sửa được bằng cỡ chữ, độ đậm và khoảng trắng.",
  },
  {
    title: "Ôn tập phương trình bậc hai",
    who: "cho học sinh lớp 9",
    text: "Bài ôn tập về phương trình bậc hai cho học sinh lớp 9 trước kỳ thi vào lớp 10. Học sinh đã học công thức nghiệm nhưng hay nhầm dấu của biệt thức. Sau buổi học, học sinh giải được phương trình bậc hai và biện luận được số nghiệm theo biệt thức.",
  },
  {
    title: "Viết câu lệnh cho AI tạo sinh",
    who: "tập huấn cho giảng viên",
    text: "Buổi tập huấn về viết câu lệnh (prompt) hiệu quả cho giảng viên chưa quen dùng AI tạo sinh. Sau buổi tập huấn, giảng viên viết được câu lệnh có đủ vai trò, bối cảnh, yêu cầu và định dạng đầu ra, và biết kiểm tra lại câu trả lời của AI.",
  },
];

type Mode = "topic" | "file" | "text";
const MODE_LABEL: Record<Mode, string> = { topic: "Mô tả chủ đề", file: "Tải tệp lên", text: "Dán văn bản" };

const ERROR_TEXT: Record<string, string> = {
  file_too_large: `Tệp lớn hơn ${MAX_MB} MB. Hãy chọn tệp nhỏ hơn hoặc dán phần văn bản cần dùng.`,
  unsupported_file_type: "Chỉ nhận tệp Word (.docx), PDF, văn bản (.txt) hoặc Markdown (.md).",
  no_text_in_file: "Không đọc được chữ trong tệp này. Nếu là PDF scan từ ảnh thì cần bản có chữ chọn được; bạn cũng có thể dán văn bản vào ô bên dưới.",
  source_too_short: "Tài liệu quá ngắn để soạn bài giảng. Hãy dùng tài liệu có ít nhất vài đoạn văn.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Vui lòng thử lại vào ngày mai.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này.",
  empty_outline: "AI chưa soạn được dàn ý. Hãy thử lại, hoặc viết mô tả rõ hơn hay dùng tài liệu khác.",
  topic_too_short: `Mô tả quá ngắn. Hãy viết ít nhất một câu nêu chủ đề, người học và mục tiêu.`,
  topic_too_long: `Mô tả dài hơn ${TOPIC_MAX.toLocaleString("vi-VN")} ký tự. Nếu bạn có sẵn tài liệu, hãy dùng tab "Dán văn bản".`,
  openai_error: "AI đang bận hoặc gặp lỗi. Vui lòng thử lại sau ít phút.",
  json_parse_failed: "AI trả lời chưa đúng định dạng. Vui lòng thử lại.",
};

export default function FromDocumentForm({ webAvailable = false }: { webAvailable?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>("topic");
  const [topic, setTopic] = useState("");
  // Có dịch vụ tìm kiếm thì bật sẵn: giảng viên không phải nghĩ thêm, AI có nguồn để dẫn.
  const [useWeb, setUseWeb] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const chooseFile = (f: File | null) => {
    if (f && /\.pptx?$/i.test(f.name)) {
      setFile(null);
      setError("Bài giảng PowerPoint dùng mục \"PowerPoint\" ở trên: Limio giữ được cả hình, ghi chú giảng, bảng và biểu đồ.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const ready = mode === "topic" ? topic.trim().length >= TOPIC_MIN : mode === "file" ? !!file : text.trim().length > 0;
  const searching = mode === "topic" && webAvailable && useWeb;

  const submit = async () => {
    setError(null);
    if (mode === "file" && file && file.size > MAX_MB * 1024 * 1024) return setError(ERROR_TEXT.file_too_large!);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("minutes", String(minutes));
      if (mode === "topic") {
        fd.set("topic", topic);
        if (searching) fd.set("web", "1");
      } else if (mode === "file" && file) fd.set("file", file);
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
        <h1 className="mt-1 text-2xl font-bold">Tạo bài giảng</h1>
        <p className="mt-2 text-muted">
          Mô tả bài giảng bạn cần, hoặc đưa tài liệu Word, PDF, văn bản. AI sẽ đề xuất dàn ý slide; bạn xem và sửa dàn ý
          trước, rồi mới tạo slide.
        </p>
        <a
          href="/instructor/limio-live?new=1"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-[rgb(var(--text))] hover:underline"
        >
          <Pencil size={14} /> Hoặc soạn thủ công từ bài trống
        </a>
      </div>

      <section className="space-y-3" aria-labelledby="src-h">
        <h2 id="src-h" className="text-lg font-semibold">
          1. Nội dung bài giảng
        </h2>
        <div className="inline-flex flex-wrap rounded-full border border-token p-0.5 text-sm" role="group" aria-label="Cách nhập nội dung">
          {(["topic", "file", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 font-medium ${mode === m ? "bg-brand-600 text-white" : "text-muted"}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
          {/* Bài giảng PowerPoint có luồng riêng (giữ hình, ghi chú giảng, bảng, biểu đồ). */}
          <a href="/instructor/limio-live/from-pptx" className="rounded-full px-4 py-1.5 font-medium text-muted hover:text-[rgb(var(--text))]">
            PowerPoint
          </a>
        </div>

        {mode === "topic" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-token bg-[rgb(var(--surface))] focus-within:border-brand-500">
              <textarea
                ref={topicRef}
                // "Tạo bài giảng" mở thẳng trang này: con trỏ đặt sẵn trong ô mô tả để gõ ngay.
                autoFocus
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={6}
                maxLength={TOPIC_MAX}
                placeholder="Ví dụ: Bài giới thiệu về thực tế tăng cường (AR) trong lớp học cho sinh viên năm cuối ngành Công nghệ giáo dục. Sau buổi học, sinh viên phân biệt được AR với VR và đề xuất được một hoạt động học dùng AR."
                className="block w-full resize-y rounded-2xl border-0 bg-transparent px-4 py-3 text-base leading-relaxed focus:outline-none focus:ring-0"
                aria-label="Mô tả bài giảng"
                aria-describedby="topic-hint"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-token px-4 py-2 text-[13px] text-muted">
                <span>
                  {topic.length.toLocaleString("vi-VN")} / {TOPIC_MAX.toLocaleString("vi-VN")} ký tự
                </span>
                <span>Viết càng rõ, dàn ý càng sát ý bạn.</span>
              </div>
            </div>
            {topic.length >= TOPIC_MAX && (
              <p className="banner-info text-sm">
                Mô tả đã chạm giới hạn {TOPIC_MAX.toLocaleString("vi-VN")} ký tự. Nếu bạn có sẵn tài liệu, hãy dùng tab
                &quot;Dán văn bản&quot; để AI bám sát tài liệu đó.
              </p>
            )}
            <ul id="topic-hint" className="grid gap-1 text-sm text-muted">
              <li>Chủ đề của bài giảng là gì, và phạm vi đến đâu.</li>
              <li>Người học là ai: năm học, ngành, mức hiểu biết hiện có.</li>
              <li>Sau buổi học, người học làm được điều gì.</li>
            </ul>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted">Ví dụ mẫu, bấm để điền</p>
              {TOPIC_EXAMPLES.map((ex) => (
                <button
                  key={ex.title}
                  type="button"
                  onClick={() => {
                    setTopic(ex.text);
                    topicRef.current?.focus();
                  }}
                  className="block w-full rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-2.5 text-left text-sm text-muted transition hover:border-brand-500 hover:text-[rgb(var(--text))]"
                >
                  <b className="font-semibold text-[rgb(var(--text))]">{ex.title}</b>, {ex.who}
                </button>
              ))}
            </div>
            {webAvailable && (
              <div className="flex items-start gap-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useWeb}
                  aria-labelledby="web-l"
                  aria-describedby="web-d"
                  onClick={() => setUseWeb((v) => !v)}
                  className={`relative mt-0.5 h-6 w-11 flex-none rounded-full transition ${useWeb ? "bg-brand-600" : "bg-[rgb(var(--text-faint))]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${useWeb ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <div>
                  <p id="web-l" className="font-semibold">
                    Tìm thêm nguồn trên internet
                  </p>
                  <p id="web-d" className="text-sm text-muted">
                    {useWeb
                      ? "Hệ thống tìm vài trang liên quan cho AI đọc. Số liệu và trích dẫn chỉ được dùng khi có trong các trang đó, kèm nguồn ở chân slide."
                      : "AI viết từ kiến thức chung, không đưa số liệu, trích dẫn hay tên người vào slide."}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : mode === "file" ? (
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
              if (f) chooseFile(f);
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
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
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
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} aria-hidden />}
          {busy ? "Đang soạn dàn ý..." : "Soạn dàn ý"}
        </button>
        {busy && (
          <p className="text-sm text-muted">
            {searching
              ? "Hệ thống đang tìm nguồn và AI đang soạn dàn ý, thường mất từ 30 đến 90 giây."
              : mode === "topic"
                ? "AI đang soạn dàn ý, thường mất từ 20 đến 60 giây."
                : "AI đang đọc tài liệu, thường mất từ 20 đến 60 giây."}{" "}
            Vui lòng không đóng trang.
          </p>
        )}
      </div>
    </main>
  );
}
