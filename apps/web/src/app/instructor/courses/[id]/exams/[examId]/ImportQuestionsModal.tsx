"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Sparkles, Upload as UploadIcon } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

interface Props {
  examId: string;
  open: boolean;
  onClose: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "MCQ",
  multi: "MULTI",
  true_false_notgiven: "T/F/NG",
  gap_fill: "Gap fill",
  short_answer: "Short",
  essay: "Essay",
  ordering: "Sắp xếp",
  matching: "Ghép cặp",
};

interface ParsedRow {
  rowNumber: number;
  status: "ok" | "warning" | "error";
  errors: string[];
  warnings: string[];
  parsed?: {
    type: string;
    prompt: string;
    points: number;
    difficulty: number;
    passageId: string | null;
    passageTitleRaw: string;
    skillIds: string[];
    unresolvedSkillCodes: string[];
    /** Chỉ có ở đường AI import (ai-preview) — file-based preview không trả field này cho client. */
    config?: unknown;
  };
}

interface PreviewResponse {
  rows: ParsedRow[];
  summary: { ok: number; warning: number; error: number; total: number };
}

interface ConfirmResponse {
  imported: number;
  skippedError: number;
  skippedWarning: number;
  errors: Array<{ rowNumber: number; errors: string[] }>;
}

/** Câu AI đọc thấy nhưng không đủ rõ để phân loại thành 1 trong 5 dạng hỗ trợ. */
interface SkippedAiQuestion {
  reason: string;
}

/** Đáp án đúng — mỗi loại có khái niệm khác nhau, đọc trực tiếp từ config đã validate. */
function answerSummary(type: string, config: unknown): string {
  if (!config || typeof config !== "object") return "—";
  const c = config as Record<string, unknown>;
  switch (type) {
    case "mcq":
    case "multi": {
      const options = Array.isArray(c.options) ? c.options : [];
      const correct = options
        .filter((o): o is { label: string; isCorrect: boolean } => !!o?.isCorrect)
        .map((o) => o.label);
      return correct.join(", ") || "—";
    }
    case "true_false_notgiven":
      return typeof c.correct === "string" ? c.correct : "—";
    case "ordering": {
      const items = Array.isArray(c.items) ? c.items : [];
      return items.map((i: { label: string }) => i.label).join(" → ") || "—";
    }
    case "matching": {
      const pairs = Array.isArray(c.pairs) ? c.pairs : [];
      return (
        pairs.map((p: { left: string; right: string }) => `${p.left}→${p.right}`).join(", ") ||
        "—"
      );
    }
    case "short_answer": {
      const accepted = Array.isArray(c.acceptedAnswers) ? c.acceptedAnswers : [];
      return accepted.join(" / ") || "—";
    }
    default:
      return "—";
  }
}

/** Việt hoá lỗi từ /ai-preview — không hiện mã lỗi thô cho GV. */
function humanizeAiError(code: string | undefined, details: unknown): string {
  switch (code) {
    case "empty_content":
    case "validation_failed":
      return "Hãy dán nội dung câu hỏi trước đã.";
    case "too_short":
      return "Nội dung quá ngắn — AI cần ít nhất khoảng 20 ký tự để đọc hiểu.";
    case "too_long":
      return "Nội dung quá dài (trên 20.000 ký tự). Hãy chia nhỏ và làm từng phần.";
    case "openai_not_configured":
      return "Tính năng AI chưa được cấu hình. Báo quản trị hệ thống.";
    case "no_token_budget":
      return "Bạn đã dùng hết token AI của tháng này. Có thể mua thêm ở trang Token AI.";
    case "global_token_cap":
      return "Hệ thống đang tạm hết hạn mức AI dùng chung. Thử lại sau ít phút.";
    case "json_parse_failed":
    case "openai_error":
      return "AI không đọc được nội dung này, thử lại hoặc rút gọn văn bản.";
    case "forbidden":
      return "Bạn không có quyền dùng tính năng này.";
    case "unauthorized":
      return "Phiên đăng nhập đã hết — đăng nhập lại rồi thử lại.";
    case "exam_has_attempts":
      return "Đề đã có người làm bài — không thể import thêm câu hỏi.";
    default:
      return typeof details === "string"
        ? details
        : `Chưa định dạng được (mã: ${code ?? "unknown"}). Thử lại.`;
  }
}

export default function ImportQuestionsModal({ examId, open, onClose }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  /** Đường tạo ra `preview` — quyết định confirm gọi endpoint nào (file re-parse vs ai-commit theo rows). */
  const [source, setSource] = useState<"file" | "ai" | null>(null);
  const [aiSkipped, setAiSkipped] = useState<SkippedAiQuestion[]>([]);
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ConfirmResponse | null>(null);

  if (!open) return null;

  function reset() {
    setFile(null);
    setPreview(null);
    setSource(null);
    setAiSkipped([]);
    setDone(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runPreview(f: File) {
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", f);
    const res = await fetch(
      apiUrl(`/api/exams/${examId}/questions/import/preview`),
      { method: "POST", body: form },
    );
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        typeof data?.details === "string"
          ? data.details
          : typeof data?.error === "string"
            ? data.error
            : "preview_failed",
      );
      return;
    }
    setSource("file");
    setPreview(data as PreviewResponse);
  }

  async function runAiPreview(rawText: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/questions/import/ai-preview`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(humanizeAiError(data?.error, data?.details));
      return;
    }
    const j = data as PreviewResponse & { skipped?: SkippedAiQuestion[] };
    const skipped = j.skipped ?? [];
    if (j.summary.total === 0) {
      setError(
        skipped.length > 0
          ? `AI tìm thấy ${skipped.length} câu nhưng không đọc rõ đủ để phân loại. Xem chi tiết bên dưới.`
          : "Không tìm thấy câu hỏi nào trong nội dung này — kiểm tra lại văn bản đã dán.",
      );
      return;
    }
    setSource("ai");
    setAiSkipped(skipped);
    setPreview(j);
  }

  async function runConfirm() {
    setLoading(true);
    setError(null);
    if (source === "ai") {
      if (!preview) {
        setLoading(false);
        return;
      }
      const rows = preview.rows.filter((r) =>
        includeWarnings ? r.status !== "error" : r.status === "ok",
      );
      const res = await fetch(apiUrl(`/api/exams/${examId}/questions/import/ai-commit`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      setLoading(false);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(humanizeAiError(data?.error, data?.details));
        return;
      }
      setDone({
        imported: data.imported ?? 0,
        skippedError: preview.summary.error,
        skippedWarning: includeWarnings ? 0 : preview.summary.warning,
        errors: (data.errors ?? []).map((e: { rowNumber: number; message: string }) => ({
          rowNumber: e.rowNumber,
          errors: [e.message],
        })),
      });
      router.refresh();
      return;
    }
    if (!file) {
      setLoading(false);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("includeWarnings", includeWarnings ? "true" : "false");
    const res = await fetch(
      apiUrl(`/api/exams/${examId}/questions/import/confirm`),
      { method: "POST", body: form },
    );
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "confirm_failed");
      return;
    }
    setDone(data as ConfirmResponse);
    router.refresh();
  }

  function close() {
    reset();
    onClose();
  }

  const summary = preview?.summary;
  const importableCount = summary
    ? includeWarnings
      ? summary.ok + summary.warning
      : summary.ok
    : 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-default px-5 py-3">
          <h2 className="flex items-center gap-1.5 text-base font-semibold"><UploadIcon className="h-4 w-4 shrink-0 text-slate-400" /> Nhập câu hỏi</h2>
          <button type="button" onClick={close} className="text-faint hover:text-red-600">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {done ? (
            <DoneScreen result={done} />
          ) : preview ? (
            <>
              {aiSkipped.length > 0 && (
                <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p className="font-semibold">
                    AI đã bỏ qua {aiSkipped.length} câu — không đọc rõ đủ để phân loại:
                  </p>
                  <ul className="mt-1 list-inside list-disc">
                    {aiSkipped.map((s, i) => (
                      <li key={i}>{s.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              <PreviewTable rows={preview.rows} />
            </>
          ) : (
            <Upload
              loading={loading}
              examId={examId}
              fileInputRef={fileInputRef}
              onFile={async (f) => {
                setFile(f);
                await runPreview(f);
              }}
              onExtractAi={runAiPreview}
            />
          )}
          {error && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default px-5 py-3">
          {preview && !done && summary && (
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                ✓ {summary.ok}
              </span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                ⚠ {summary.warning}
              </span>
              <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
                ✗ {summary.error}
              </span>
              <label className="ml-3 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={includeWarnings}
                  onChange={(e) => setIncludeWarnings(e.target.checked)}
                />
                <span>Bao gồm row có cảnh báo</span>
              </label>
            </div>
          )}
          {!preview && !done && <div />}
          <div className="ml-auto flex gap-2">
            {done ? (
              <button
                type="button"
                onClick={close}
                className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white"
              >
                Xong
              </button>
            ) : preview ? (
              <>
                <button
                  type="button"
                  onClick={reset}
                  disabled={loading}
                  className="rounded border border-default px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {source === "ai" ? "Làm lại" : "Chọn file khác"}
                </button>
                <button
                  type="button"
                  onClick={runConfirm}
                  disabled={loading || importableCount === 0}
                  className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? "Đang import…" : `Import ${importableCount} câu`}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={close}
                className="rounded border border-default px-3 py-1.5 text-sm"
              >
                Huỷ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Upload({
  examId,
  fileInputRef,
  onFile,
  onExtractAi,
  loading,
}: {
  examId: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
  onExtractAi: (rawText: string) => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"file" | "ai">("file");
  const [rawText, setRawText] = useState("");

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            mode === "file" ? "bg-white text-slate-900 shadow-sm" : "text-faint hover:text-slate-700"
          }`}
        >
          Tải file Excel
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 transition-colors ${
            mode === "ai" ? "bg-white text-slate-900 shadow-sm" : "text-faint hover:text-slate-700"
          }`}
        >
          <Sparkles className="h-3 w-3" /> Dán & định dạng bằng AI
        </button>
      </div>

      {mode === "file" ? (
        <>
          <p>
            Tải template Excel mẫu, điền câu hỏi, rồi upload lại để import vào bài
            thi này.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={apiUrl(`/api/exams/${examId}/questions/template`)}
              className="rounded border border-default px-3 py-1.5 hover:bg-slate-50"
              download
            >
              <Download className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Tải template
            </a>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded bg-brand-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Đang phân tích…" : <><UploadIcon className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Chọn file Excel</>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </div>
          <details className="rounded border border-default bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-medium">Hướng dẫn nhanh</summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Sheet `Questions`: 1 hàng = 1 câu hỏi, cột Type bắt buộc</li>
              <li>Cột `PassageTitle` khớp tên đoạn — nếu trống → câu hỏi độc lập</li>
              <li>MCQ: điền OptionA/B/C/D + Correct = chữ cái (vd. B)</li>
              <li>MULTI: Correct phân tách bằng `;` (vd. A;C)</li>
              <li>GAP_FILL Blanks: `b1:đáp1|đáp2 ; b2:đáp1`</li>
              <li>SkillCodes phân tách bằng `;`, phải khớp code đã có</li>
            </ul>
          </details>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <p className="font-semibold">Hướng dẫn:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>
                Dán nội dung câu hỏi — copy nguyên văn từ Word, PDF, hoặc gõ tay.
                Định dạng tuỳ ý, nhiều câu một lúc, hỗ trợ trắc nghiệm, đúng/sai,
                sắp xếp thứ tự, ghép cặp, điền khuyết.
              </li>
              <li>
                Đáp án đúng đánh dấu kiểu gì cũng được (in đậm, "Đáp án: B",
                dấu *...) — AI sẽ tự nhận diện.
              </li>
              <li>
                AI chỉ đọc hiểu, không tự bịa — câu nào AI không chắc sẽ bị bỏ
                qua và báo ở bước xem trước, không tự đoán.
              </li>
              <li>Bấm "Định dạng bằng AI" → xem trước → sửa nếu cần → import.</li>
            </ol>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={loading}
            rows={10}
            maxLength={20_000}
            placeholder={
              "Ví dụ:\nCâu 1: Thủ đô của Việt Nam là gì?\nA. Hà Nội\nB. TP. Hồ Chí Minh\nĐáp án: A"
            }
            className="w-full rounded-lg border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-faint">{rawText.length}/20.000 ký tự</span>
            <button
              type="button"
              disabled={loading || rawText.trim().length < 20}
              onClick={() => onExtractAi(rawText)}
              className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {loading ? "Đang định dạng…" : "Định dạng bằng AI"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PreviewTable({ rows }: { rows: ParsedRow[] }) {
  return (
    <div>
      <p className="mb-2 text-sm">
        Kiểm tra danh sách trước khi import. Row đỏ ✗ sẽ bị bỏ qua. Row vàng ⚠
        có thể chọn bỏ qua hoặc import (xem checkbox bên dưới).
      </p>
      <div className="overflow-x-auto rounded border border-default">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Trạng thái</th>
              <th className="px-2 py-1.5">Loại</th>
              <th className="px-2 py-1.5">Đề bài</th>
              <th className="px-2 py-1.5">Đáp án</th>
              <th className="px-2 py-1.5 text-right">Điểm</th>
              <th className="px-2 py-1.5 text-center">Độ khó</th>
              <th className="px-2 py-1.5">Đoạn</th>
              <th className="px-2 py-1.5">Skill</th>
              <th className="px-2 py-1.5">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {rows.map((r) => (
              <tr key={r.rowNumber} className="align-top">
                <td className="px-2 py-1.5 font-mono">{r.rowNumber}</td>
                <td className="px-2 py-1.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-2 py-1.5">
                  {r.parsed && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">
                      {TYPE_LABEL[r.parsed.type] ?? r.parsed.type}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 max-w-xs truncate">
                  {r.parsed?.prompt}
                </td>
                <td className="px-2 py-1.5 max-w-[200px]">
                  {r.parsed ? (
                    <span className="line-clamp-2 text-faint">
                      {answerSummary(r.parsed.type, r.parsed.config)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">{r.parsed?.points}</td>
                <td className="px-2 py-1.5 text-center">
                  {r.parsed?.difficulty}
                </td>
                <td className="px-2 py-1.5">
                  {r.parsed?.passageId ? (
                    <span className="truncate text-emerald-700">
                      ✓ {r.parsed.passageTitleRaw}
                    </span>
                  ) : r.parsed?.passageTitleRaw ? (
                    <span className="text-amber-700" title={r.parsed.passageTitleRaw}>
                      ⚠ không khớp
                    </span>
                  ) : (
                    <span className="text-faint">(độc lập)</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {r.parsed && r.parsed.unresolvedSkillCodes.length > 0 ? (
                    <span
                      className="text-amber-700"
                      title={r.parsed.unresolvedSkillCodes.join(", ")}
                    >
                      ⚠ {r.parsed.unresolvedSkillCodes.length} thiếu
                    </span>
                  ) : r.parsed && r.parsed.skillIds.length > 0 ? (
                    <span className="text-emerald-700">✓ {r.parsed.skillIds.length}</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {r.errors.length > 0 && (
                    <ul className="text-red-700">
                      {r.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {r.warnings.length > 0 && (
                    <ul className="text-amber-700">
                      {r.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "warning" | "error" }) {
  const map = {
    ok: { text: "✓ OK", cls: "bg-emerald-100 text-emerald-800" },
    warning: { text: "⚠ Cảnh báo", cls: "bg-amber-100 text-amber-800" },
    error: { text: "✗ Lỗi", cls: "bg-red-100 text-red-800" },
  };
  const v = map[status];
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 ${v.cls}`}>{v.text}</span>;
}

function DoneScreen({ result }: { result: ConfirmResponse }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded border border-emerald-300 bg-emerald-50 p-4 text-center">
        <div className="text-3xl font-bold text-emerald-700">{result.imported}</div>
        <div className="text-xs text-emerald-800">câu hỏi đã import</div>
      </div>
      {(result.skippedError > 0 || result.skippedWarning > 0) && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          Đã bỏ qua: {result.skippedError} lỗi · {result.skippedWarning} cảnh báo
        </div>
      )}
      {result.errors.length > 0 && (
        <details className="rounded border border-default p-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Chi tiết row bị skip ({result.errors.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {result.errors.map((e) => (
              <li key={e.rowNumber}>
                Row {e.rowNumber}: {e.errors.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
