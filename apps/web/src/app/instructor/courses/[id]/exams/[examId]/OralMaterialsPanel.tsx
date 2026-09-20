"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  FileText,
  List,
  ScrollText,
  Trash2,
  Upload,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import EmptyState from "@/components/ui/EmptyState";

type MaterialType = "document" | "topic_list" | "rubric";

interface Material {
  id: string;
  type: MaterialType;
  title: string;
  mimeType: string | null;
  sizeBytes: number | null;
  extractedText: string | null;
  orderIndex: number;
  /** Số đoạn đã nhúng vector (0 = AI chưa lấy được đoạn nào của tài liệu này). */
  chunkCount: number;
}

const TYPE_LABEL: Record<MaterialType, string> = {
  document: "Tài liệu",
  rubric: "Rubric chấm điểm",
  topic_list: "Danh sách chủ đề",
};

const TYPE_ICON: Record<MaterialType, typeof FileText> = {
  document: FileText,
  rubric: ScrollText,
  topic_list: List,
};

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FRIENDLY_ERROR: Record<string, string> = {
  no_file: "Chưa chọn file.",
  title_required: "Cần nhập tiêu đề.",
  invalid_type: "Loại tài liệu không hợp lệ.",
  unsupported_media_type: "Định dạng file không hỗ trợ — chỉ nhận PDF, .docx, .txt, .md.",
  file_too_large: "File quá lớn — tối đa 20MB.",
  openai_not_configured: "Máy chủ chưa cấu hình khoá OpenAI nên chưa nhúng được tài liệu.",
  global_token_cap: "Hôm nay hệ thống đã hết hạn mức token AI — thử nhúng lại vào ngày mai.",
  openai_error: "OpenAI báo lỗi khi nhúng tài liệu — thử lại sau ít phút.",
};

export default function OralMaterialsPanel({
  examId,
  editable,
}: {
  examId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"file" | "topics" | null>(null);
  const [busy, setBusy] = useState(false);
  const [embeddingId, setEmbeddingId] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-materials`));
    if (res.ok) {
      const data = (await res.json()) as { materials: Material[] };
      setMaterials(data.materials);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function handleDelete(id: string) {
    if (!confirm("Xoá tài liệu này? AI sẽ không còn dùng nó để hỏi nữa.")) return;
    setErr(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-materials/${id}`), {
      method: "DELETE",
    });
    if (!res.ok) {
      setErr("Xoá thất bại.");
      return;
    }
    await refresh();
    router.refresh();
  }

  // Nhúng (hoặc nhúng lại) 1 tài liệu — route đã có từ A6.2 nhưng trước đây không có nút nào gọi nó.
  async function handleEmbed(id: string) {
    setErr(null);
    setEmbeddingId(id);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/oral-materials/${id}/embed`), {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(FRIENDLY_ERROR[data.error ?? ""] ?? `Nhúng thất bại (${data.error ?? res.status}).`);
      }
    } finally {
      setEmbeddingId(null);
      await refresh();
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    if (!materials) return;
    const target = index + dir;
    if (target < 0 || target >= materials.length) return;
    const next = [...materials];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setMaterials(next);
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-materials/reorder`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((m) => m.id) }),
    });
    if (!res.ok) {
      setErr("Sắp xếp lại thất bại.");
      await refresh();
    }
  }

  return (
    <section className="mt-6 rounded border border-default bg-white p-5">
      <h2 className="mb-1 text-base font-semibold">Tài liệu cho AI giám khảo</h2>
      <p className="mb-4 text-sm text-faint">
        AI dựa vào các tài liệu này để đặt câu hỏi cho sinh viên — sinh viên
        không bao giờ nhìn thấy nội dung ở đây. Nộp đề cương, danh sách chủ
        đề, hoặc rubric chấm điểm. Lượt mở màn chỉ lấy vài đoạn đầu của{" "}
        <strong>tài liệu đứng đầu danh sách</strong>; từ lượt sau AI tìm đoạn
        theo nội dung câu trả lời của sinh viên.
      </p>

      {!editable && (
        <p className="banner-warning mb-4 px-3 py-2 text-caption">
          Đề đã publish hoặc lưu trữ — tài liệu đã khoá, không thêm/sửa/xoá
          được nữa.
        </p>
      )}

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      {materials === null ? (
        <p className="text-sm text-faint">Đang tải…</p>
      ) : materials.length === 0 ? (
        <EmptyState
          icon="📄"
          title="Chưa có tài liệu nào"
          description="Không có tài liệu, AI sẽ không biết hỏi gì — thêm ít nhất 1 tài liệu trước khi publish."
        />
      ) : (
        <ul className="space-y-2">
          {materials.map((m, i) => {
            const Icon = TYPE_ICON[m.type];
            const parseFailed = m.type !== "topic_list" && m.extractedText === null;
            return (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded border border-default p-3"
              >
                <Icon aria-hidden size={18} className="mt-0.5 shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="text-caption text-faint">
                    {TYPE_LABEL[m.type]}
                    {m.sizeBytes !== null && ` · ${formatSize(m.sizeBytes)}`}
                  </p>
                  {!parseFailed && m.extractedText && (
                    <p
                      className={`mt-1 text-caption ${
                        m.chunkCount > 0 ? "text-emerald-700" : "font-medium text-amber-700"
                      }`}
                    >
                      {m.chunkCount > 0
                        ? `Đã nhúng · ${m.chunkCount} đoạn — AI tìm được đoạn liên quan khi hỏi.`
                        : "Chưa nhúng — AI chưa lấy được đoạn nào của tài liệu này khi hỏi, chỉ dựa vào hướng dẫn giám khảo."}{" "}
                      <button
                        type="button"
                        onClick={() => handleEmbed(m.id)}
                        disabled={embeddingId === m.id}
                        className="underline underline-offset-2 disabled:opacity-50"
                      >
                        {embeddingId === m.id
                          ? "Đang nhúng…"
                          : m.chunkCount > 0
                            ? "Nhúng lại"
                            : "Nhúng ngay"}
                      </button>
                    </p>
                  )}
                  {parseFailed && (
                    <p className="mt-1 banner-danger px-0 py-0 text-caption">
                      Không đọc được nội dung file này — AI sẽ bỏ qua. Thử xoá
                      và tải lại, hoặc đổi sang PDF/txt/docx khác.
                    </p>
                  )}
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Đưa lên"
                      disabled={i === 0}
                      onClick={() => handleMove(i, -1)}
                      className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Đưa xuống"
                      disabled={i === materials.length - 1}
                      onClick={() => handleMove(i, 1)}
                      className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Xoá"
                      onClick={() => handleDelete(m.id)}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <div className="mt-5">
          {addMode === null ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddMode("file")}
                className="btn btn-secondary btn-sm"
              >
                <Upload size={14} className="mr-1.5 inline" />
                Tải file lên
              </button>
              <button
                type="button"
                onClick={() => setAddMode("topics")}
                className="btn btn-secondary btn-sm"
              >
                <List size={14} className="mr-1.5 inline" />
                Nhập danh sách chủ đề
              </button>
            </div>
          ) : addMode === "file" ? (
            <UploadForm
              examId={examId}
              busy={busy}
              setBusy={setBusy}
              setErr={setErr}
              onDone={async () => {
                setAddMode(null);
                await refresh();
                router.refresh();
              }}
              onCancel={() => setAddMode(null)}
            />
          ) : (
            <TopicListForm
              examId={examId}
              busy={busy}
              setBusy={setBusy}
              setErr={setErr}
              onDone={async () => {
                setAddMode(null);
                await refresh();
                router.refresh();
              }}
              onCancel={() => setAddMode(null)}
            />
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => router.push(`${pathname}?tab=organize`)}
          className="btn btn-primary btn-sm"
        >
          Tiếp tục
          <ArrowRight size={14} className="ml-1.5 inline" />
        </button>
      </div>
    </section>
  );
}

function UploadForm({
  examId,
  busy,
  setBusy,
  setErr,
  onDone,
  onCancel,
}: {
  examId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setErr: (e: string | null) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Chưa chọn file.");
      return;
    }
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.set("file", file);
    form.set("title", title.trim() || file.name);
    // A6.4 — "rubric" giờ là Exam.oralRubricText (ô nhập riêng ở trang Chấm
    // bài), không còn là loại tài liệu upload — chỉ còn "document".
    form.set("type", "document");
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-materials`), {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const code = typeof data?.error === "string" ? data.error : "";
      setErr(FRIENDLY_ERROR[code] ?? code ?? "Tải lên thất bại.");
      return;
    }
    onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded border border-default bg-slate-50 p-4"
    >
      <div>
        <label className="block text-sm font-medium" htmlFor="material-title">
          Tiêu đề
        </label>
        <input
          id="material-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vd: Đề cương chương 3"
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="material-file">
          File (PDF, .docx, .txt, .md — tối đa 20MB)
        </label>
        <input
          id="material-file"
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="mt-1 w-full text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Huỷ
        </button>
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "Đang tải lên…" : "Tải lên"}
        </button>
      </div>
    </form>
  );
}

function TopicListForm({
  examId,
  busy,
  setBusy,
  setErr,
  onDone,
  onCancel,
}: {
  examId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setErr: (e: string | null) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-materials/topic-list`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), text: text.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(typeof data?.error === "string" ? data.error : "Lưu thất bại.");
      return;
    }
    onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded border border-default bg-slate-50 p-4"
    >
      <div>
        <label className="block text-sm font-medium" htmlFor="topics-title">
          Tiêu đề
        </label>
        <input
          id="topics-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vd: Danh sách chủ đề vấn đáp"
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="topics-text">
          Nội dung
        </label>
        <textarea
          id="topics-text"
          required
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Mỗi dòng 1 chủ đề, hoặc đoạn văn mô tả phạm vi hỏi…"}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Huỷ
        </button>
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </form>
  );
}
