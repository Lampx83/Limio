"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

export interface LegacyCandidate {
  id: string;
  title: string;
  status: string;
  materials: number;
  topics: number;
  hasPrompt: boolean;
  alreadyImported: boolean;
}

const ERRORS: Record<string, string> = {
  forbidden: "Thầy/cô không có quyền sửa đề vấn đáp này.",
  not_found: "Đề vấn đáp cũ này không còn tồn tại.",
  legacy_not_oral: "Đây không phải đề vấn đáp.",
};

/** AC0.4 — Nhập từ đề vấn đáp cũ: tạo một đề MỚI (nháp), đề cũ không đổi. Không phụ thuộc việc bản cũ còn bật hay tắt. */
export default function ImportLegacy({ candidates }: { candidates: LegacyCandidate[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  async function run(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/van-dap/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legacyExamId: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { examId?: string; error?: string };
      if (!res.ok || !data.examId) {
        setError(ERRORS[data.error ?? ""] ?? "Không nhập được, thử lại sau.");
        return;
      }
      router.push(`/instructor/van-dap/${data.examId}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="vd-import-title">
      <h2 id="vd-import-title" className="text-h3">
        Nhập từ đề vấn đáp cũ
      </h2>
      <p className="mt-1 text-sm text-faint">
        Sao chép tài liệu, chủ đề (thành kịch bản) và rubric sang một đề Limio Vấn đáp MỚI ở dạng nháp. Đề cũ giữ nguyên. Prompt
        cũ chỉ hiện ở khung chỉ đọc để đối chiếu, không tự chép sang.
      </p>
      {error && (
        <p className="banner-danger mt-3 text-sm" role="alert">
          {error}
        </p>
      )}
      <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-default bg-white">
        {candidates.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{c.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {c.materials} tài liệu · {c.topics} chủ đề{c.hasPrompt ? " · có prompt" : ""}
                {c.alreadyImported ? " · đã nhập trước đó" : ""}
              </p>
            </div>
            <button type="button" onClick={() => run(c.id)} disabled={busyId !== null} className="btn btn-secondary btn-sm disabled:opacity-50">
              {busyId === c.id ? "Đang nhập…" : "Nhập"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
