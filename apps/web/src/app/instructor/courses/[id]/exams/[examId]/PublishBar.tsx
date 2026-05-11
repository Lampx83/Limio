"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

interface Props {
  examId: string;
  courseId: string;
  status: string;
  hasAttempts: boolean;
}

export default function PublishBar({ examId, courseId, status, hasAttempts }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    setDetails(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/publish`), {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "publish_failed");
      if (Array.isArray(data?.details?.errors)) {
        setDetails(data.details.errors);
      }
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (
      !window.confirm(
        hasAttempts
          ? "Xoá bài thi này? Không cho phép khi đã có lượt thi."
          : "Xoá bài thi này? Hành động không thể hoàn tác.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}`), { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data?.error === "string" ? data.error : "delete_failed");
      return;
    }
    router.replace(`/instructor/courses/${courseId}/exams`);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <button
            type="button"
            onClick={publish}
            disabled={busy}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Đang publish…" : "Publish"}
          </button>
        )}
        {!hasAttempts && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Xoá
          </button>
        )}
      </div>
      {error && (
        <div className="max-w-md rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-medium">Không publish được: {error}</p>
          {details && details.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
