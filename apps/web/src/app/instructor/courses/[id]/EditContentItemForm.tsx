"use client";

/**
 * Inline edit form for an existing ContentItem. Mirrors the field UI of
 * AddContentItemForm but pre-fills from the existing payload and PATCHes
 * `/api/contents/[id]` instead of POSTing.
 *
 * Scope:
 *   - markdown / video / embed / file / external_link / pdf  → full edit
 *   - scorm / h5p / lti                                      → only `title`
 *     (changing the underlying package/tool requires recreate, since the
 *     instructor flow couples upload → pick → bind in AddContentItemForm.)
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import AiFormatPanel from "@/components/AiFormatPanel";
import SafeHtml from "@/components/SafeHtml";
import { EXTENSIONS } from "@/components/RichTextEditor";
import { readLessonLook, type LessonLook } from "@feedbackme/shared-types";
import { probeEditorLoss } from "@/components/richtext/lossProbe";
import VersionHistory from "@/components/lesson/VersionHistory";
import LessonRichText from "@/components/lesson/LessonRichText";
import { convertLegacyAiHtml, type ConvertResult } from "@/lib/legacyLessonConvert";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
});

import { DialogueEditor, VocabListEditor } from "./LangBlockEditors";
import LessonFileUploadPanel from "./LessonFileUploadPanel";
import {
  dialogueEditorFromPayload,
  dialoguePayloadFromEditor,
  validateDialogueEditor,
  validateVocabEditor,
  vocabEditorFromPayload,
  vocabPayloadFromEditor,
  type DialogueEditorValue,
  type VocabEditorValue,
} from "@/lib/langBlockEditor";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

type ContentType =
  | "video"
  | "markdown"
  | "richtext"
  | "embed"
  | "file"
  | "external_link"
  | "pdf"
  | "scorm"
  | "lti"
  | "h5p"
  | "html_block"
  | "audio"
  | "vocab_list"
  | "dialogue";

interface Props {
  item: {
    id: string;
    type: string;
    payload: unknown;
  };
  lessonId: string;
  onClose: () => void;
}

export default function EditContentItemForm({ item, lessonId, onClose }: Props) {
  const router = useRouter();
  const type = item.type as ContentType;
  const initial = (item.payload ?? {}) as Record<string, unknown>;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common scalar fields, pre-filled from the existing payload.
  const [body, setBody] = useState<string>(String(initial.body ?? ""));
  const [html, setHtml] = useState<string>(String(initial.html ?? ""));
  // Bảng màu + kiểu chữ của bài văn bản. null = bài cũ chưa chọn (hiện như trước).
  const [look, setLook] = useState<LessonLook | null>(() => readLessonLook(initial.look));
  const [url, setUrl] = useState<string>(String(initial.url ?? ""));
  const [filename, setFilename] = useState<string>(String(initial.filename ?? ""));
  // Cỡ + kiểu của file đính kèm: giữ của bản cũ nếu không đổi file; upload mới
  // thì thay; gõ tay URL khác thì bỏ.
  const [fileMeta, setFileMeta] = useState<{ sizeBytes: number; mimeType: string } | null>(() =>
    typeof initial.sizeBytes === "number" && typeof initial.mimeType === "string"
      ? { sizeBytes: initial.sizeBytes, mimeType: initial.mimeType }
      : null,
  );
  const [linkTitle, setLinkTitle] = useState<string>(String(initial.title ?? ""));
  const [htmlBlockBody, setHtmlBlockBody] = useState<string>(
    String(initial.body ?? ""),
  );
  const [audioTranscript, setAudioTranscript] = useState<string>(String(initial.transcript ?? ""));
  const [audioShowTranscript, setAudioShowTranscript] = useState<boolean>(initial.showTranscript !== false);
  const [vocabValue, setVocabValue] = useState<VocabEditorValue>(() => vocabEditorFromPayload(item.payload));
  const [dialogueValue, setDialogueValue] = useState<DialogueEditorValue>(() => dialogueEditorFromPayload(item.payload));

  // Nội dung richtext đã qua AI format (heading màu, callout, bảng có style
  // riêng...) không có schema tương ứng trong RichTextEditor — mở thẳng bằng
  // WYSIWYG sẽ mất định dạng ngay lần sửa đầu, và trước đây hiện cảnh báo đỏ
  // dọa người dùng. Giờ dò 1 lần lúc mount: nếu phức tạp, ưu tiên hiện PREVIEW
  // đẹp + hướng dẫn thân thiện; không lộ mã HTML ra cho người dùng.
  // null = chưa dò xong (chỉ dò được ở trình duyệt).
  const [aiSaved, setAiSaved] = useState(false);
  const [richtextComplex, setRichtextComplex] = useState<boolean | null>(null);
  const initialHtmlRef = useRef(String(initial.html ?? ""));
  // Bài AI kiểu cũ (bị khoá): thử chuyển sang dạng khối mới ngay khi mở (S5).
  const [converted, setConverted] = useState<ConvertResult | null>(null);
  const [converting, setConverting] = useState(false);
  // Lần lưu này có dùng "Nhờ AI" → phiên bản cũ mang nhãn "Trước khi nhờ AI sửa" (S3).
  const aiEditedRef = useRef(false);
  // Đổi khoá để dựng lại trình soạn sau khi khôi phục/chuyển (trình soạn chỉ dò nội dung lúc mở).
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (type !== "richtext") return;
    const complex = !!probeEditorLoss(initialHtmlRef.current, EXTENSIONS);
    setRichtextComplex(complex);
    if (complex) setConverted(convertLegacyAiHtml(initialHtmlRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /** Chuyển bài AI kiểu cũ sang dạng mới: lưu ngay, bản cũ vào lịch sử (before_convert). */
  async function applyConversion() {
    if (!converted?.ok) return;
    setConverting(true);
    try {
      const res = await fetch(apiUrl(`/api/contents/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { html: converted.html, look: converted.look }, versionSource: "before_convert" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setHtml(converted.html);
      setLook(converted.look);
      setRichtextComplex(false);
      setEditorKey((k) => k + 1);
      toast.success("Đã chuyển sang dạng mới — giờ sửa tay được.");
      router.refresh();
    } catch {
      toast.error("Chưa chuyển được. Vui lòng thử lại.");
    } finally {
      setConverting(false);
    }
  }

  /** Sau khi khôi phục một phiên bản: nạp lại nội dung và dựng lại trình soạn. */
  function onRestored(p: { html?: string; look?: unknown }) {
    const h = String(p.html ?? "");
    setHtml(h);
    setLook(readLessonLook(p.look));
    const complex = !!probeEditorLoss(h, EXTENSIONS);
    setRichtextComplex(complex);
    setConverted(complex ? convertLegacyAiHtml(h) : null);
    setAiSaved(false);
    setEditorKey((k) => k + 1);
    toast.success("Đã khôi phục phiên bản.");
    router.refresh();
  }

  async function redraft() {
    if (!window.confirm("Mở màn Dàn ý dựng từ chính bài này để sắp xếp lại và cho AI viết lại? Bài hiện tại vẫn giữ nguyên cho tới khi bạn Áp dụng, và được lưu trong Lịch sử.")) return;
    const res = await fetch(apiUrl(`/api/contents/${item.id}/redraft`), { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { courseId?: string; lessonId?: string; error?: string };
    if (!res.ok || !d.courseId) {
      toast.error(d.error === "empty_content" ? "Bài đang trống, chưa có gì để lập dàn ý." : "Chưa mở được dàn ý. Vui lòng thử lại.");
      return;
    }
    router.push(`/instructor/courses/${d.courseId}/lessons/${d.lessonId}/from-document`);
  }

  /**
   * "Áp dụng và lưu" trong AiFormatPanel gọi thẳng đây — PATCH ngay với HTML
   * đã AI định dạng, bỏ qua nút "Lưu" chung của form. CHỈ lưu — AiFormatPanel
   * tự chuyển sang màn "Đã lưu bài học" + nút "Đóng form" gọi onClose (prop
   * có sẵn của form này) khi GV bấm, không tự đóng ở đây.
   */
  async function saveRichtextViaAi(formattedHtml: string) {
    const res = await fetch(apiUrl(`/api/contents/${item.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { html: formattedHtml } }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error ?? `http_${res.status}`);
    }
    // Bản đã format là bản duy nhất hiển thị; đồng bộ state để nút "Lưu" chung
    // không ghi đè lại bằng bản gốc, ẩn ô nhập bản gốc.
    setHtml(formattedHtml);
    // Bản AI định dạng kiểu cũ tự mang màu riêng — không áp bảng màu lên nữa.
    setLook(null);
    setAiSaved(true);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let payload: Record<string, unknown>;
    switch (type) {
      case "markdown":
        payload = { body };
        break;
      case "richtext":
        if (!html.trim()) {
          setError("empty_content");
          setBusy(false);
          return;
        }
        // PATCH thay cả payload: phải gửi lại bảng màu, không thì mất.
        payload = look ? { html, look } : { html };
        break;
      case "video":
      case "embed":
        payload = { url };
        break;
      case "file":
        payload = { url, filename, ...(fileMeta ?? {}) };
        break;
      case "external_link":
      case "pdf":
        payload = { url, title: linkTitle.trim() || undefined };
        break;
      case "html_block":
        payload = {
          url,
          title: linkTitle.trim() || undefined,
          body: htmlBlockBody.trim() || undefined,
        };
        break;
      case "vocab_list": {
        const problems = validateVocabEditor(vocabValue);
        if (problems.length) {
          setError(problems.join(" "));
          setBusy(false);
          return;
        }
        payload = vocabPayloadFromEditor(vocabValue);
        break;
      }
      case "dialogue": {
        const problems = validateDialogueEditor(dialogueValue);
        if (problems.length) {
          setError(problems.join(" "));
          setBusy(false);
          return;
        }
        payload = dialoguePayloadFromEditor(dialogueValue);
        break;
      }
      case "audio":
        // Giữ nguyên các trường form này không sửa (caption, durationSec) —
        // PATCH thay cả payload nên bỏ sót là mất.
        payload = {
          ...initial,
          url: url.trim(),
          title: linkTitle.trim() || undefined,
          transcript: audioTranscript.trim() || undefined,
          showTranscript: audioShowTranscript ? undefined : false,
        };
        break;
      case "scorm":
        payload = {
          ...(initial as { packageId: string }),
          title: linkTitle.trim() || undefined,
        };
        break;
      case "h5p":
        payload = {
          ...(initial as { packageId: string }),
          title: linkTitle.trim() || undefined,
        };
        break;
      case "lti":
        payload = {
          ...(initial as { toolId: string }),
          title: linkTitle.trim() || undefined,
        };
        break;
      default:
        setError(`unsupported_type:${type}`);
        setBusy(false);
        return;
    }

    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/contents/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "richtext" && aiEditedRef.current ? { payload, versionSource: "before_ai" } : { payload },
        ),
      });
    } catch (networkErr) {
      setBusy(false);
      console.error("[EditContentItemForm] network error", networkErr);
      const msg = "Không kết nối được tới server";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(false);
    if (res.ok) {
      toast.success("Đã cập nhật content");
      router.refresh();
      onClose();
      return;
    }
    const d = await res.json().catch(() => ({}));
    const code = (d as { error?: string }).error ?? `http_${res.status}`;
    console.error("[EditContentItemForm] update failed", res.status, d);
    setError(code);
    toast.error(`Cập nhật thất bại: ${code}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="chip-brand">Sửa {type}</span>
      </div>

      {type === "markdown" && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          placeholder="Nội dung markdown..."
          className="textarea"
        />
      )}

      {type === "richtext" && richtextComplex === null && (
        <div className="h-24 animate-pulse rounded-lg bg-[rgb(var(--surface-muted))]" aria-hidden />
      )}

      {type === "richtext" && richtextComplex === false && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-auto text-xs font-semibold uppercase tracking-wide text-faint">Nội dung</span>
            <VersionHistory contentItemId={item.id} onRestored={onRestored} />
            <button type="button" onClick={redraft} className="btn-ghost btn-sm">
              Làm lại từ dàn ý
            </button>
          </div>
          {aiSaved ? (
            <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
              <SafeHtml html={html} className="prose prose-sm max-w-none dark:prose-invert" />
            </div>
          ) : (
            <RichTextEditor
              key={editorKey}
              value={html}
              onChange={setHtml}
              lessonTools
              look={look}
              onLookChange={setLook}
              aiLessonId={lessonId}
              onAiApplied={() => {
                aiEditedRef.current = true;
              }}
            />
          )}
        </div>
      )}

      {type === "richtext" && richtextComplex === true && converted?.ok && (
        <div className="space-y-3">
          <div className="banner-info flex flex-wrap items-center gap-3 text-sm">
            <span className="flex-1">
              Bài này được AI định dạng theo kiểu cũ nên chưa sửa tay được. Chuyển sang dạng mới để sửa thoải mái —
              chữ và ảnh giữ nguyên, bản cũ được lưu trong Lịch sử.
            </span>
            <button type="button" onClick={applyConversion} disabled={converting} className="btn-primary btn-sm">
              {converting ? "Đang chuyển…" : "Chuyển sang dạng mới"}
            </button>
          </div>
          <p className="text-meta font-semibold">Bản sau khi chuyển</p>
          <LessonRichText html={converted.html} look={converted.look} />
        </div>
      )}

      {type === "richtext" && richtextComplex === true && !converted?.ok && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <VersionHistory contentItemId={item.id} onRestored={onRestored} />
          </div>
          <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
            <SafeHtml html={html} className="prose prose-sm max-w-none dark:prose-invert" />
          </div>
          <p className="banner-info text-sm">
            Nội dung này có định dạng riêng mà trình soạn thảo chưa biểu diễn được, nên chưa sửa trực tiếp được.
            Muốn thay đổi, dùng &ldquo;Định dạng bằng AI&rdquo; bên dưới.
          </p>
          <AiFormatPanel
            lessonId={lessonId}
            html={html}
            onSaved={saveRichtextViaAi}
            onClose={onClose}
          />
        </div>
      )}

      {(type === "video" ||
        type === "embed" ||
        type === "file" ||
        type === "external_link" ||
        type === "pdf") && (
        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFileMeta(null);
            }}
            required
            // video / file / pdf có thể là đường dẫn cùng origin (/api/lesson-media/...)
            // của file đã upload — type="url" từ chối dạng đó, như ở AddContentItemForm.
            type={type === "embed" || type === "external_link" ? "url" : "text"}
            placeholder="URL"
            className="input"
          />
          {type === "file" && (
            <LessonFileUploadPanel
              onUploaded={(f) => {
                setUrl(f.url);
                setFileMeta({ sizeBytes: f.sizeBytes, mimeType: f.mime });
                setFilename(f.originalName.slice(0, 200));
              }}
            />
          )}
        </div>
      )}

      {type === "file" && (
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          required
          maxLength={200}
          placeholder="Tên file"
          className="input"
        />
      )}

      {(type === "external_link" ||
        type === "pdf" ||
        type === "scorm" ||
        type === "h5p" ||
        type === "lti") && (
        <input
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
          maxLength={200}
          placeholder="Tiêu đề (optional)"
          className="input"
        />
      )}

      {/* Cùng thứ tự với AddContentItemForm: tiêu đề + mô tả (nội dung học
          viên đọc) trước, URL file (chi tiết kỹ thuật) sau. */}
      {type === "html_block" && (
        <>
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề — sẽ hiện thành link bấm mở được (dòng trên cùng)"
            className="input"
          />
          <RichTextEditor
            value={htmlBlockBody}
            onChange={setHtmlBlockBody}
            placeholder="Mô tả (optional) — hiện ngay dưới tiêu đề"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            // URL là same-origin upload path (/api/lesson-media/html/<file>)
            // — type="url" sẽ reject giá trị dạng path thuần.
            type="text"
            placeholder="URL"
            className="input"
          />
        </>
      )}

      {type === "vocab_list" && <VocabListEditor value={vocabValue} onChange={setVocabValue} />}
      {type === "dialogue" && <DialogueEditor value={dialogueValue} onChange={setDialogueValue} />}

      {type === "audio" && (
        <div className="space-y-2">
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề bài nghe"
            className="input"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            type="text"
            placeholder="URL audio"
            className="input"
          />
          {url.trim() && (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- bản nghe thử cho giảng viên
            <audio src={url.trim()} controls preload="metadata" className="w-full" />
          )}
          <div>
            <label
              htmlFor="audio-transcript-edit"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-faint"
            >
              Lời thoại <span className="font-normal normal-case">(không bắt buộc)</span>
            </label>
            <textarea
              id="audio-transcript-edit"
              value={audioTranscript}
              onChange={(e) => setAudioTranscript(e.target.value)}
              maxLength={20000}
              rows={5}
              placeholder="Chép lại nội dung audio. Mỗi người nói một dòng, ví dụ: A：你好！"
              className="input"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={audioShowTranscript}
              onChange={(e) => setAudioShowTranscript(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Cho học viên xem lời thoại
              <span className="block text-xs text-muted">
                Bỏ chọn với bài nghe hiểu: lời thoại sẽ không được gửi tới học viên.
              </span>
            </span>
          </label>
        </div>
      )}

      {type === "pdf" && url.trim() && (
        <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.4] p-3">
          <PdfViewer url={url.trim()} title={linkTitle || undefined} />
        </div>
      )}

      {(type === "scorm" || type === "h5p" || type === "lti") && (
        <p className="text-xs text-muted">
          Chỉ chỉnh được tiêu đề. Để đổi package/tool, hãy xoá rồi tạo lại
          content này.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
        {error && (
          <span className="text-xs text-danger-600">Lỗi: {error}</span>
        )}
      </div>
    </form>
  );
}
