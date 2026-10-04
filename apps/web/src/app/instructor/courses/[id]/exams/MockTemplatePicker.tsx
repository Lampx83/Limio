"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

const TEMPLATES = [
  { id: "hsk", label: "HSK", hint: "Nghe · Đọc · Viết" },
  { id: "ielts", label: "IELTS", hint: "Listening · Reading · Writing (không có Speaking)" },
  { id: "toeic", label: "TOEIC", hint: "Listening · Reading" },
  { id: "custom", label: "Tuỳ chỉnh", hint: "Đề trống, tự thêm các phần" },
] as const;

/**
 * LANG G5c.1 — tạo đề THI THỬ từ khung. Khung chỉ dựng cấu trúc (các phần + kỹ năng),
 * không kèm câu hỏi, giờ hay thang điểm: số liệu chính thức giảng viên tự đối chiếu rồi điền.
 */
export default function MockTemplatePicker({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<(typeof TEMPLATES)[number]["id"] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/courses/${courseId}/exams`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mockTemplate: picked, title }),
      });
      const j = (await res.json().catch(() => null)) as { examId?: string; error?: string } | null;
      if (!res.ok || !j?.examId) {
        setError(j?.error === "validation_failed" ? "Nhập tiêu đề đề thi." : "Không tạo được đề. Vui lòng thử lại.");
        setBusy(false);
        return;
      }
      router.replace(`/instructor/courses/${courseId}/exams/${j.examId}?created=1&tab=content`);
    } catch {
      setError("Không tạo được đề. Kiểm tra mạng rồi thử lại.");
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded border border-default bg-white p-5" data-testid="mock-template-picker">
      <h2 className="flex items-center gap-1.5 text-base font-semibold">
        <Timer className="h-4 w-4 shrink-0 text-slate-400" /> Tạo đề thi thử từ khung
      </h2>
      <p className="mt-1 text-sm text-faint">
        Đề thi thử có giờ riêng từng phần, học viên làm lần lượt và không quay lại. Khung chỉ dựng sẵn các phần và kỹ
        năng; bạn tự thêm câu hỏi và điền số phút từng phần.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={picked === t.id}
            onClick={() => setPicked(t.id)}
            className={`rounded border p-3 text-left text-sm transition-colors ${
              picked === t.id ? "border-blue-600 bg-blue-50" : "border-default hover:bg-slate-50"
            }`}
          >
            <span className="block font-semibold">{t.label}</span>
            <span className="block text-xs text-faint">{t.hint}</span>
          </button>
        ))}
      </div>
      {picked && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[16rem] flex-1 text-sm">
            <span className="mb-1 block font-medium">Tiêu đề đề thi</span>
            <input
              className="w-full rounded border border-default px-3 py-2"
              value={title}
              maxLength={200}
              placeholder="Vd: Thi thử HSK 3 — đề 1"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || title.trim() === ""}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Đang tạo…" : "Tạo đề"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
