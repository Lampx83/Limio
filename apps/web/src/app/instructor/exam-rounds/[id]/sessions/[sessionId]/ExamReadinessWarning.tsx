import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Surface a warning if the exam linked to a session/room isn't ready for
 * candidates to enter via /exam/{accessCode}:
 *  - accessMode must be `assigned_code` so per-candidate codes are valid
 *  - status must be `published` so the public claim page accepts them
 */
export default function ExamReadinessWarning({
  courseId,
  examId,
  examAccessMode,
  examStatus,
}: {
  courseId: string;
  examId: string;
  examAccessMode: string;
  examStatus: string;
}) {
  // Both assigned_code and open_code are valid setups for the new flow.
  // Only `authenticated` (default, unconfigured) needs a warning prompting
  // the instructor to pick a mode via "Chế độ thi" card.
  const wrongMode = examAccessMode === "authenticated";
  const notPublished = examStatus !== "published";
  if (!wrongMode && !notPublished) return null;

  const fixLink = `/instructor/courses/${courseId}/exams/${examId}`;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" /> Sinh viên chưa thể vào thi qua mã thi
      </div>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
        {wrongMode && (
          <li>
            Đề thi chưa được setup chế độ — chọn ở card "Chế độ thi" phía
            trên (Theo phòng hoặc Tự do).
          </li>
        )}
        {notPublished && (
          <li>
            Đề thi đang ở trạng thái{" "}
            <code className="rounded bg-white px-1">{examStatus}</code> — phải{" "}
            <Link
              href={`${fixLink}?tab=overview`}
              className="font-medium underline"
            >
              publish đề thi
            </Link>{" "}
            trước khi phát mã cho sinh viên.
          </li>
        )}
      </ul>
    </div>
  );
}
