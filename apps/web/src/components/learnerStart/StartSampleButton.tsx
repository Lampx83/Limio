"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { sendOnboardingEvent } from "./onboardingEvent";

/**
 * "Học thử" (AC3): ghi danh miễn phí vào khoá mẫu rồi mở bài đầu tiên. Ghi danh thật để học viên làm được
 * bài kiểm tra và nhận phản hồi — đọc thử không ghi danh thì không nộp bài được.
 */
export default function StartSampleButton({
  courseId,
  courseSlug,
  lessonId,
}: {
  courseId: string;
  courseSlug: string;
  lessonId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function start() {
    setBusy(true);
    setError(false);
    sendOnboardingEvent("sample", courseId);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/enroll`), { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      router.push(`/learn/${courseSlug}/lessons/${lessonId}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void start()} disabled={busy} className="btn-primary">
        {busy ? "Đang mở bài…" : "Học thử"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          Chưa mở được bài học thử. Bạn thử lại sau ít phút nhé.
        </p>
      )}
    </div>
  );
}
