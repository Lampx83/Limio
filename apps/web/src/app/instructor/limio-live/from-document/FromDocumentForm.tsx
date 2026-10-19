"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Pencil, Presentation, Sparkles, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { DURATIONS } from "@/lib/limioLiveOutline";
import { PASTE_AS_DOC_CHARS, TOPIC_MAX, canSubmitCreate, classifyUpload, handOffPptx, pasteAsDocument } from "@/lib/limioLiveCreateSource";

const MAX_MB = 10;
const PPTX_MAX_MB = 50;

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
  unsupported_file_type: "Chỉ nhận tệp Word (.docx), PDF, văn bản (.txt), Markdown (.md) hoặc PowerPoint (.pptx).",
  pptx_too_large: `Tệp PowerPoint lớn hơn ${PPTX_MAX_MB} MB. Trong PowerPoint, dùng chức năng Nén ảnh (Compress Pictures) rồi lưu lại.`,
  // Cùng câu với trang nhập PowerPoint.
  legacy_ppt:
    "File .ppt là định dạng PowerPoint đời cũ. Hãy mở file bằng PowerPoint, chọn Lưu thành (Save As), chọn định dạng .pptx rồi tải file mới lên.",
  no_text_in_file: "Không đọc được chữ trong tệp này. Nếu là PDF scan từ ảnh thì cần bản có chữ chọn được; thầy/cô cũng có thể dán văn bản vào ô.",
  source_too_short: "Tài liệu quá ngắn để soạn bài giảng. Hãy dùng tài liệu có ít nhất vài đoạn văn.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Vui lòng thử lại vào ngày mai.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này.",
  empty_outline: "AI chưa soạn được dàn ý. Hãy thử lại, hoặc viết mô tả rõ hơn hay dùng tài liệu khác.",
  topic_too_short: `Mô tả quá ngắn. Hãy viết ít nhất một câu nêu chủ đề, người học và mục tiêu.`,
  topic_too_long: `Mô tả dài hơn ${TOPIC_MAX.toLocaleString("vi-VN")} ký tự. Tài liệu dài thì đính kèm hoặc dán thẳng cả đoạn vào ô (đoạn dài tự thành tài liệu).`,
  openai_error: "AI đang bận hoặc gặp lỗi. Vui lòng thử lại sau ít phút.",
  json_parse_failed: "AI trả lời chưa đúng định dạng. Vui lòng thử lại.",
};

/** Tài liệu đính kèm: một tệp, hoặc một đoạn văn bản dài đã dán (docs/tieu-chi/tao-bai-giang-mot-o.md, M3–M4). */
type Attachment = { kind: "file"; file: File; pptx: boolean } | { kind: "paste"; text: string };

const mb = (n: number) => (n / 1024 / 1024).toFixed(1).replace(".", ",");

export default function FromDocumentForm({ webAvailable = false }: { webAvailable?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState("");
  const [att, setAtt] = useState<Attachment | null>(null);
  // Dòng báo nhỏ dưới thẻ tài liệu: tệp vừa bị thay, hoặc phần chữ bị cắt khi đưa đoạn dán lại vào ô.
  const [notice, setNotice] = useState<string | null>(null);
  // Có dịch vụ tìm kiếm thì bật sẵn: giảng viên không phải nghĩ thêm, AI có nguồn để dẫn.
  const [useWeb, setUseWeb] = useState(true);
  const [minutes, setMinutes] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const hasDoc = !!att && !(att.kind === "file" && att.pptx);
  const isPptx = att?.kind === "file" && att.pptx;
  const ready = canSubmitCreate({ description: topic, hasAttachment: !!att });
  const searching = !att && webAvailable && useWeb;
  const attName = (a: Attachment) => (a.kind === "file" ? a.file.name : "Văn bản dán");

  /** Mỗi bài chỉ một tài liệu (M3): tệp mới thay tệp cũ, kèm dòng báo. */
  const attach = (next: Attachment) => {
    setError(null);
    setNotice(att ? `Mỗi bài chỉ dùng một tài liệu: tệp mới đã thay cho “${attName(att)}”.` : null);
    setAtt(next);
  };

  const chooseFile = (f: File | null | undefined) => {
    if (!f) return;
    const kind = classifyUpload(f.name);
    if (kind === "legacy_ppt") return setError(ERROR_TEXT.legacy_ppt!);
    if (kind === "unsupported") return setError(ERROR_TEXT.unsupported_file_type!);
    if (kind === "pptx" && f.size > PPTX_MAX_MB * 1024 * 1024) return setError(ERROR_TEXT.pptx_too_large!);
    if (kind === "doc" && f.size > MAX_MB * 1024 * 1024) return setError(ERROR_TEXT.file_too_large!);
    attach({ kind: "file", file: f, pptx: kind === "pptx" });
  };

  /** Dán đoạn dài khi chưa có tài liệu: đoạn đó thành tài liệu "Văn bản dán", ô mô tả giữ nguyên (M4). */
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const t = e.clipboardData.getData("text");
    if (!pasteAsDocument(t, !!att)) return;
    e.preventDefault();
    attach({ kind: "paste", text: t.trim() });
  };

  /** "Đưa lại vào ô mô tả": hệ thống hiểu nhầm đoạn dán là tài liệu. Ô mô tả chỉ giữ 2.000 ký tự. */
  const pasteBack = () => {
    if (att?.kind !== "paste") return;
    const merged = [topic.trim(), att.text].filter(Boolean).join("\n\n");
    setTopic(merged.slice(0, TOPIC_MAX));
    setAtt(null);
    setNotice(merged.length > TOPIC_MAX ? `Ô mô tả chỉ giữ ${TOPIC_MAX.toLocaleString("vi-VN")} ký tự đầu của đoạn đã dán.` : null);
    topicRef.current?.focus();
  };

  const submit = async () => {
    setError(null);
    if (!ready) return;
    // Tài liệu là PowerPoint: mở trang nhập PowerPoint với tệp đã chọn, mang theo mô tả (M7).
    if (att?.kind === "file" && att.pptx) {
      handOffPptx(att.file, topic);
      setBusy(true);
      router.push("/instructor/limio-live/from-pptx");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("minutes", String(minutes));
      if (topic.trim()) fd.set("topic", topic);
      if (att?.kind === "file") fd.set("file", att.file);
      else if (att?.kind === "paste") fd.set("text", att.text);
      else if (searching) fd.set("web", "1");
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

  // Dòng nhắc dưới ô luôn nói AI sẽ làm gì (M5).
  const mode = isPptx ? (
    <>
      AI sẽ <b className="text-brand-700">nhập bài giảng PowerPoint</b>: giữ hình, ghi chú giảng, bảng và biểu đồ. Mô tả (nếu có) được dùng làm ghi chú cho AI.
    </>
  ) : hasDoc ? (
    <>
      AI sẽ <b className="text-brand-700">bám sát tài liệu đính kèm</b> và soạn theo mô tả của thầy/cô{topic.trim() ? "" : " (mô tả không bắt buộc)"}.
    </>
  ) : topic.trim() ? (
    <>
      AI sẽ <b className="text-brand-700">soạn từ kiến thức chung</b> theo mô tả này.
    </>
  ) : (
    <>Nêu chủ đề, người học và điều người học làm được sau buổi học.</>
  );
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
      <p className="text-[15px] text-muted">Thầy/cô muốn soạn bài giảng gì? Có tài liệu thì đính kèm một tệp, AI sẽ bám sát tài liệu đó.</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          chooseFile(e.dataTransfer.files?.[0]);
        }}
        className={`overflow-hidden rounded-2xl border-2 bg-[rgb(var(--surface))] focus-within:border-brand-500 ${
          drag ? "border-dashed border-brand-500 bg-brand-50" : "border-token"
        }`}
      >
        <textarea
          ref={topicRef}
          // "Tạo bài giảng" mở thẳng trang này: con trỏ đặt sẵn trong ô mô tả để gõ ngay.
          autoFocus
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onPaste={onPaste}
          rows={4}
          maxLength={TOPIC_MAX}
          placeholder={
            hasDoc
              ? "Thầy/cô muốn bài giảng thế nào? Ví dụ: dạy cho sinh viên năm nhất, tập trung phần ứng dụng, thêm một câu hỏi thảo luận."
              : "Ví dụ: Bài giới thiệu về thực tế tăng cường (AR) trong lớp học cho sinh viên năm cuối ngành Công nghệ giáo dục. Sau buổi học, sinh viên phân biệt được AR với VR và đề xuất được một hoạt động học dùng AR."
          }
          className="block w-full resize-y border-0 bg-transparent px-4 pb-1.5 pt-3 text-base leading-relaxed focus:outline-none focus:ring-0"
          aria-label="Mô tả bài giảng"
          aria-describedby="topic-hint"
        />
        {att && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-1.5 pt-1">
            <span className="inline-flex max-w-full items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface-muted))] py-1.5 pl-2.5 pr-1.5 text-[13.5px]">
              {isPptx ? <Presentation size={18} className="flex-none text-orange-700" aria-hidden /> : <FileText size={18} className="flex-none text-brand-700" aria-hidden />}
              <b className="truncate font-semibold">{attName(att)}</b>
              <span className="whitespace-nowrap text-muted">
                {att.kind === "file" ? `${mb(att.file.size)} MB` : `${att.text.length.toLocaleString("vi-VN")} ký tự`}
              </span>
              {att.kind === "paste" && (
                <button type="button" onClick={pasteBack} className="whitespace-nowrap text-[12.5px] font-medium text-brand-700 underline">
                  Đưa lại vào ô mô tả
                </button>
              )}
              <button
                type="button"
                aria-label="Bỏ tài liệu"
                onClick={() => {
                  setAtt(null);
                  setNotice(null);
                }}
                className="rounded p-0.5 text-muted hover:text-[rgb(var(--text))]"
              >
                <X size={16} />
              </button>
            </span>
          </div>
        )}
        {notice && <p className="mx-4 mb-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-800">{notice}</p>}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-2 text-[13px] text-muted">
          <span id="topic-hint">{mode}</span>
          {topic.length > 0 && (
            <span className="tabular-nums">
              {topic.length.toLocaleString("vi-VN")} / {TOPIC_MAX.toLocaleString("vi-VN")}
            </span>
          )}
        </div>

        {/* Hàng thao tác: đính kèm, thời lượng, nguồn internet (khi không có tài liệu), nút Soạn dàn ý. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
          <button type="button" className="btn-secondary flex items-center gap-1.5" onClick={() => fileRef.current?.click()}>
            <Paperclip size={15} aria-hidden /> {att ? "Đổi tài liệu" : "Đính kèm tài liệu"}
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".docx,.pdf,.txt,.md,.pptx,.ppt,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={(e) => {
              chooseFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {!isPptx && (
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
          )}
          {!att && webAvailable && (
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
            {busy ? <Loader2 size={16} className="animate-spin" /> : isPptx ? <Presentation size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
            {busy ? (isPptx ? "Đang mở trang nhập..." : "Đang soạn dàn ý...") : isPptx ? "Nhập PowerPoint" : "Soạn dàn ý"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      {busy && !isPptx && (
        <p className="text-sm text-muted" role="status">
          {searching
            ? "Hệ thống đang tìm nguồn và AI đang soạn dàn ý, thường mất từ 30 đến 90 giây."
            : hasDoc
              ? "AI đang đọc tài liệu, thường mất từ 20 đến 60 giây."
              : "AI đang soạn dàn ý, thường mất từ 20 đến 60 giây."}{" "}
          Vui lòng không đóng trang.
        </p>
      )}

      {!att && (
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
      )}
      <p className="text-[13px] text-muted">
        Có sẵn bài giảng PowerPoint? Đính kèm tệp .pptx vào ô trên, Limio giữ hình, ghi chú giảng, bảng và biểu đồ. Dán đoạn văn dài hơn{" "}
        {PASTE_AS_DOC_CHARS.toLocaleString("vi-VN")} ký tự vào ô thì đoạn đó tự thành tài liệu.
      </p>
    </main>
  );
}
