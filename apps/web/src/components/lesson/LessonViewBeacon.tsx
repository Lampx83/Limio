"use client";

import { useEffect } from "react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Bắn một nhịp lúc mount để máy chủ ghi lastLessonId / lastPositionSec cho
 * tính năng "học tiếp chỗ đang dở". Tách khỏi UI (trước nằm chung trong thanh
 * điều hướng cố định dưới đáy, nay thanh đó đã bỏ) vì nhịp tim này không cần
 * hiển thị gì. Việc tự đánh dấu hoàn thành nằm ở LessonCompletionPrompt.
 */
export default function LessonViewBeacon({
  lessonId,
  initialResumeSec,
}: {
  lessonId: string;
  initialResumeSec: number;
}) {
  useEffect(() => {
    fetch(apiUrl(`/api/lessons/${lessonId}/view`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: initialResumeSec }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  return null;
}
