"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lightbulb, Loader2, Pencil, Presentation, Sparkles, UploadCloud, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { DURATIONS } from "@/lib/limioLiveOutline";
import { CREATE_SOURCES, TOPIC_MIN, canSubmitSource, classifyUpload, handOffPptx, type CreateSource } from "@/lib/limioLiveCreateSource";

const MAX_MB = 10;
// Khớp TOPIC_MAX_CHARS của core-feedback (máy chủ kiểm lại).
const TOPIC_MAX = 2000;
const SOURCE_ICON = { idea: Lightbulb, doc: FileText, pptx: Presentation } as const;

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

const ERROR_TEXT: Record<string, string> = {
  file_too_large: `Tệp lớn hơn ${MAX_MB} MB. Hãy chọn tệp nhỏ hơn hoặc dán phần văn bản cần dùng.`,
  unsupported_file_type: "Chỉ nhận tệp Word (.docx), PDF, văn bản (.txt) hoặc Markdown (.md). Bài giảng PowerPoint dùng thẻ \u201cTừ bài PowerPoint\u201d.",
  unsupported_pptx: "Chỉ nhận file PowerPoint dạng .pptx.",
  // Cùng câu với trang nhập PowerPoint.
  legacy_ppt:
    "File .ppt là định dạng PowerPoint đời cũ. Hãy mở file bằng PowerPoint, chọn Lưu thành (Save As), chọn định dạng .pptx rồi tải file mới lên.",
  no_text_in_file: "Không đọc được chữ trong tệp này. Nếu là PDF scan từ ảnh thì cần bản có chữ chọn được; bạn cũng có thể dán văn bản vào ô bên dưới.",
  source_too_short: "Tài liệu quá ngắn để soạn bài giảng. Hãy dùng tài liệu có ít nhất vài đoạn văn.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Vui lòng thử lại vào ngày mai.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này.",
  empty_outline: "AI chưa soạn được dàn ý. Hãy thử lại, hoặc viết mô tả rõ hơn hay dùng tài liệu khác.",
  topic_too_short: `Mô tả quá ngắn. Hãy viết ít nhất một câu nêu chủ đề, người học và mục tiêu.`,
  topic_too_long: `Mô tả dài hơn ${TOPIC_MAX.toLocaleString("vi-VN")} ký tự. Nếu thầy/cô có sẵn tài liệu, hãy chọn thẻ \u201cTừ tài liệu\u201d.`,
  openai_error: "AI đang bận hoặc gặp lỗi. Vui lòng thử lại sau ít phút.",
  json_parse_failed: "AI trả lời chưa đúng định dạng. Vui lòng thử lại.",
};

export default function FromDocumentForm({ webAvailable = false }: { webAvailable?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const pptxRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const cardRefs = useRef<Record<CreateSource, HTMLButtonElement | null>>({ idea: null, doc: null, pptx: null });
  const [source, setSource] = useState<CreateSource>("idea");
  const [topic, setTopic] = useState("");
  // Có dịch vụ tìm kiếm thì bật sẵn: giảng viên không phải nghĩ thêm, AI có nguồn để dẫn.
  const [useWeb, setUseWeb] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [openingPptx, setOpeningPptx] = useState(false);

  const pickSource = (s: CreateSource, focus = false) => {
    setSource(s);
    setError(null);
    if (focus) cardRefs.current[s]?.focus();
  };

  // Tệp PowerPoint (ở thẻ PowerPoint, hoặc lỡ thả vào thẻ tài liệu) mở trang nhập PowerPoint với tệp đã chọn sẵn.
  const openPptx = (f: File) => {
    handOffPptx(f);
    setOpeningPptx(true);
    router.push("/instructor/limio-live/from-pptx");
  };

  const chooseFile = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    const kind = classifyUpload(f.name);
    if (kind === "pptx") return openPptx(f);
    if (kind === "legacy_ppt") return setError(ERROR_TEXT.legacy_ppt!);
    if (kind === "unsupported") return setError(ERROR_TEXT.unsupported_file_type!);
    setFile(f);
  };

  const choosePptx = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    const kind = classifyUpload(f.name);
    if (kind === "pptx") return openPptx(f);
    setError(kind === "legacy_ppt" ? ERROR_TEXT.legacy_ppt! : ERROR_TEXT.unsupported_pptx!);
  };

  const ready = canSubmitSource(source, { topic, text, hasFile: !!file });
  const searching = source === "idea" && webAvailable && useWeb;

  const submit = async () => {
    setError(null);
    if (source === "doc" && file && file.size > MAX_MB * 1024 * 1024) return setError(ERROR_TEXT.file_too_large!);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("minutes", String(minutes));
      if (source === "idea") {
        fd.set("topic", topic);
        if (searching) fd.set("web", "1");
      } else if (file) fd.set("file", file);
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

  const onDrop = (e: React.DragEvent, take: (f: File) => void) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) take(f);
  };
  const dragProps = (take: (f: File) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(true);
    },
    onDragLeave: () => setDrag(false),
    onDrop: (e: React.DragEvent) => onDrop(e, take),
  });

  // Thẻ chọn nguồn, rồi một khối: ô nhập, hàng thời lượng và nút Soạn dàn ý ngay dưới, để nút luôn thấy mà không phải cuộn.
  const range = DURATIONS.find((d) => d.minutes === minutes);
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <a href="/instructor/limio-live" className="text-sm text-muted hover:underline">
            Limio-Live
          </a>
          <h1 className="text-2xl font-bold">Tạo bài giảng</h1>
        </div>
        <a
          href="/instructor/limio-live?new=1"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-[rgb(var(--text))] hover:underline"
        >
          <Pencil size={14} /> Soạn thủ công
        </a>
      </div>

      <p id="src-q" className="text-[15px] text-muted">
        Thầy/cô đang muốn tạo bài giảng tương tác từ nguyên liệu nào?
      </p>
      <div
        role="radiogroup"
        aria-labelledby="src-q"
        className="grid grid-cols-3 gap-2 sm:gap-3"
        onKeyDown={(e) => {
          const i = CREATE_SOURCES.findIndex((s) => s.id === source);
          const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          pickSource(CREATE_SOURCES[(i + step + CREATE_SOURCES.length) % CREATE_SOURCES.length]!.id, true);
        }}
      >
        {CREATE_SOURCES.map((s) => {
          const Icon = SOURCE_ICON[s.id];
          const on = source === s.id;
          return (
            <button
              key={s.id}
              ref={(el) => {
                cardRefs.current[s.id] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              title={s.hint}
              onClick={() => pickSource(s.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition sm:grid sm:grid-cols-[36px_1fr] sm:items-start sm:gap-x-3 sm:gap-y-0.5 sm:rounded-2xl sm:p-3 sm:text-left ${
                on ? "border-brand-600 bg-brand-50" : "border-token bg-[rgb(var(--surface))] hover:border-brand-500"
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-lg sm:row-span-2 sm:h-9 sm:w-9 ${
                  on ? "bg-[rgb(var(--surface))] text-brand-700" : "bg-[rgb(var(--surface-muted))] text-muted"
                }`}
              >
                <Icon size={18} aria-hidden />
              </span>
              <span className="text-[13px] font-semibold leading-tight sm:text-[15px]">{s.label}</span>
              <span className="hidden text-[13px] leading-snug text-muted sm:block">{s.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-token bg-[rgb(var(--surface))] focus-within:border-brand-500">
        {source === "idea" && (
          <>
            <textarea
              ref={topicRef}
              // "Tạo bài giảng" mở thẳng trang này: con trỏ đặt sẵn trong ô mô tả để gõ ngay.
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              maxLength={TOPIC_MAX}
              placeholder="Ví dụ: Bài giới thiệu về thực tế tăng cường (AR) trong lớp học cho sinh viên năm cuối ngành Công nghệ giáo dục. Sau buổi học, sinh viên phân biệt được AR với VR và đề xuất được một hoạt động học dùng AR."
              className="block w-full resize-y border-0 bg-transparent px-4 py-3 text-base leading-relaxed focus:outline-none focus:ring-0"
              aria-label="Mô tả bài giảng"
              aria-describedby="topic-hint"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-2 text-[13px] text-muted">
              <span id="topic-hint">Nêu chủ đề, người học và điều người học làm được sau buổi học.</span>
              <span className="tabular-nums">
                {topic.length.toLocaleString("vi-VN")} / {TOPIC_MAX.toLocaleString("vi-VN")}
              </span>
            </div>
          </>
        )}

        {source === "doc" && (
          <>
            {file ? (
              <div className="m-3 flex items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] px-3 py-2.5">
                <FileText size={22} className="flex-none text-brand-700" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{file.name}</span>
                  <span className="text-[13px] text-muted">
                    {(file.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB · AI soạn dàn ý từ tệp này
                  </span>
                </span>
                <button type="button" className="btn-secondary flex items-center gap-1" onClick={() => setFile(null)}>
                  <X size={14} aria-hidden /> Bỏ tệp
                </button>
              </div>
            ) : (
              <>
                <div
                  {...dragProps(chooseFile)}
                  className={`m-3 mb-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm ${
                    drag ? "border-brand-500 bg-brand-50" : "border-token"
                  }`}
                >
                  <UploadCloud size={22} className="text-muted" aria-hidden />
                  <span>
                    <b>Kéo tệp Word, PDF vào đây</b> <span className="text-muted">(.docx, .pdf, .txt, .md; tối đa {MAX_MB} MB)</span>
                  </span>
                  <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                    Chọn tệp
                  </button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Hoặc dán nội dung tài liệu vào đây..."
                  className="block w-full resize-y border-0 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-0"
                  aria-label="Nội dung tài liệu"
                />
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".docx,.pdf,.txt,.md,.pptx,.ppt,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                chooseFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </>
        )}

        {source === "pptx" && (
          <div
            {...dragProps((f) => choosePptx(f))}
            className={`m-3 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${drag ? "border-brand-500 bg-brand-50" : "border-token"}`}
          >
            {openingPptx ? <Loader2 size={28} className="animate-spin text-brand-700" /> : <UploadCloud size={28} className="text-muted" aria-hidden />}
            <p className="font-medium">{openingPptx ? "Đang mở trang nhập PowerPoint..." : "Kéo file PowerPoint (.pptx) vào đây hoặc bấm để chọn"}</p>
            {!openingPptx && (
              <>
                <p className="text-sm text-muted">Limio giữ hình, ghi chú giảng, bảng và biểu đồ; tối đa 50 MB.</p>
                <button type="button" className="btn-secondary" onClick={() => pptxRef.current?.click()}>
                  Chọn file
                </button>
              </>
            )}
            <input
              ref={pptxRef}
              type="file"
              hidden
              accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(e) => {
                choosePptx(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Hàng thao tác: thời lượng, nguồn internet (khi có), nút Soạn dàn ý. Thẻ PowerPoint không cần: trang nhập tự gợi ý thời lượng. */}
        {source !== "pptx" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-muted" id="dur-l">
                Thời lượng
              </span>
              <div className="inline-flex rounded-full border border-token bg-[rgb(var(--surface))] p-0.5" role="radiogroup" aria-labelledby="dur-l">
                {DURATIONS.map((d) => (
                  <button
                    key={d.minutes}
                    type="button"
                    role="radio"
                    aria-checked={minutes === d.minutes}
                    title={`Khoảng ${d.min} đến ${d.max} slide`}
                    onClick={() => setMinutes(d.minutes)}
                    className={`rounded-full px-3 py-1 font-medium ${minutes === d.minutes ? "bg-brand-600 text-white" : "text-muted"}`}
                  >
                    {d.minutes} phút
                  </button>
                ))}
              </div>
              {range && <span className="text-[13px] text-faint">khoảng {range.min} đến {range.max} slide</span>}
            </div>
            {source === "idea" && webAvailable && (
              <label
                className="flex cursor-pointer items-center gap-2 text-sm"
                title={
                  useWeb
                    ? "Hệ thống tìm vài trang liên quan cho AI đọc. Số liệu và trích dẫn chỉ được dùng khi có trong các trang đó, kèm nguồn ở chân slide."
                    : "AI viết từ kiến thức chung, không đưa số liệu, trích dẫn hay tên người vào slide."
                }
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={useWeb}
                  onClick={() => setUseWeb((v) => !v)}
                  className={`relative h-5 w-9 flex-none rounded-full transition ${useWeb ? "bg-brand-600" : "bg-[rgb(var(--text-faint))]"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${useWeb ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <span className="font-medium text-muted">Tìm thêm nguồn trên internet</span>
              </label>
            )}
            <button type="button" className="btn-primary ml-auto flex items-center gap-2 max-sm:w-full max-sm:justify-center" disabled={!ready || busy} onClick={submit}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} aria-hidden />}
              {busy ? "Đang soạn dàn ý..." : "Soạn dàn ý"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      {busy && (
        <p className="text-sm text-muted" role="status">
          {searching
            ? "Hệ thống đang tìm nguồn và AI đang soạn dàn ý, thường mất từ 30 đến 90 giây."
            : source === "idea"
              ? "AI đang soạn dàn ý, thường mất từ 20 đến 60 giây."
              : "AI đang đọc tài liệu, thường mất từ 20 đến 60 giây."}{" "}
          Vui lòng không đóng trang.
        </p>
      )}

      {source === "idea" && (
        <>
          {topic.length >= TOPIC_MAX && (
            <p className="banner-info text-sm">
              Mô tả đã chạm giới hạn {TOPIC_MAX.toLocaleString("vi-VN")} ký tự. Nếu thầy/cô có sẵn tài liệu, hãy chọn thẻ &ldquo;Từ tài
              liệu&rdquo; để AI bám sát tài liệu đó.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Ví dụ mẫu:</span>
            {TOPIC_EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                type="button"
                title={`${ex.title}, ${ex.who}. Bấm để điền vào ô mô tả.`}
                onClick={() => {
                  setTopic(ex.text);
                  topicRef.current?.focus();
                }}
                className="rounded-lg border border-token bg-[rgb(var(--surface))] px-2.5 py-1 text-[13px] text-muted transition hover:border-brand-500 hover:text-[rgb(var(--text))]"
              >
                {ex.title}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
