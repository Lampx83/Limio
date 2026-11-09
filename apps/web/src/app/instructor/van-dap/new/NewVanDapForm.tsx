"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

const ERRORS: Record<string, string> = {
  validation_failed: "Cần nhập tiêu đề, và thời lượng từ 5 đến 120 phút.",
  forbidden: "Thầy/cô không có quyền tạo đề ở đây.",
};

export default function NewVanDapForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("vi");
  const [durationMin, setDurationMin] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/van-dap/exams"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, language, durationMin }),
      });
      const data = (await res.json().catch(() => ({}))) as { examId?: string; error?: string };
      if (!res.ok || !data.examId) {
        setError(ERRORS[data.error ?? ""] ?? "Không tạo được đề, thử lại sau.");
        return;
      }
      router.push(`/instructor/van-dap/${data.examId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      {error && (
        <p className="banner-danger text-sm" role="alert">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="vd-title" className="block text-caption font-medium">
          Tiêu đề đề vấn đáp
        </label>
        <input id="vd-title" className="input mt-1 w-full" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vd-lang" className="block text-caption font-medium">
            Ngôn ngữ hỏi–đáp
          </label>
          <select id="vd-lang" className="input mt-1 w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">Tiếng Anh</option>
            <option value="zh">Tiếng Trung</option>
          </select>
        </div>
        <div>
          <label htmlFor="vd-dur" className="block text-caption font-medium">
            Thời lượng (phút)
          </label>
          <input
            id="vd-dur"
            type="number"
            min={5}
            max={120}
            className="input mt-1 w-full"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          />
        </div>
      </div>
      <button type="submit" disabled={busy || !title.trim()} className="btn btn-primary btn-sm disabled:opacity-50">
        {busy ? "Đang tạo…" : "Tạo đề"}
      </button>
    </form>
  );
}
