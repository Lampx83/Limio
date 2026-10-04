"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export type SubmissionMode = "individual" | "team";

const OPTIONS: { value: SubmissionMode; label: string }[] = [
  { value: "individual", label: "Nộp cá nhân" },
  { value: "team", label: "Nộp theo nhóm" },
];

/**
 * Lựa chọn "Cách nộp" của bài tập (docs/group-submission-AC.md C1). Dùng chung
 * cho form tạo và form sửa. Link tới trang Nhóm lấy id khoá từ URL
 * /instructor/courses/[id] — ngoài route đó thì không hiện link.
 */
export default function SubmissionModeField({
  value,
  onChange,
  name,
}: {
  value: SubmissionMode;
  onChange: (v: SubmissionMode) => void;
  /** Tên nhóm radio — phải khác nhau giữa các form cùng trang. */
  name: string;
}) {
  const params = useParams<{ id?: string }>();
  const courseId = typeof params?.id === "string" ? params.id : null;

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs text-faint">Cách nộp</legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === o.value
                ? "border-brand-400 bg-brand-soft text-brand-700"
                : "border-token bg-[rgb(var(--surface))] text-muted hover:border-brand-300"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {value === "team" && (
        <p className="text-xs text-muted">
          Một sinh viên nộp, cả nhóm có bài. Nhóm do sinh viên tự lập ở trang khoá học.
          {courseId && (
            <>
              {" "}
              <Link
                href={`/instructor/courses/${courseId}/teams`}
                className="link"
                target="_blank"
              >
                Xem các nhóm
              </Link>
            </>
          )}
        </p>
      )}
    </fieldset>
  );
}
