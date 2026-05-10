"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function DeleteCourseButton({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [enrollCount, setEnrollCount] = useState<number | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(apiUrl(`/api/courses/${courseId}`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmTitle: typed, force }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/instructor/courses");
      router.refresh();
      return;
    }
    const d = (await res.json().catch(() => ({}))) as {
      error?: string;
      details?: { count?: number };
    };
    if (d.error === "has_enrollments") {
      setEnrollCount(d.details?.count ?? null);
      setErr(
        `Khóa đang có ${d.details?.count ?? "?"} học viên enroll. Tick "Xoá luôn cả enrollment" bên dưới nếu vẫn muốn xoá (test mode).`,
      );
    } else if (d.error === "title_mismatch") {
      setErr("Tên gõ vào không khớp.");
    } else if (d.error === "forbidden") {
      setErr("Bạn không có quyền xoá khóa này.");
    } else {
      setErr(`Xoá thất bại: ${d.error ?? "unknown"}`);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm text-red-600"
      >
        Xoá khóa học
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
      <p className="mb-2 font-medium text-red-800">
        Xoá vĩnh viễn khóa này? Cascade tất cả module, lesson, content, quiz,
        assignment. Không thể hoàn tác.
      </p>
      <p className="mb-2 text-red-700">
        Gõ <code className="rounded bg-white px-1 font-mono">{courseTitle}</code>{" "}
        để xác nhận:
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoFocus
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
        placeholder={courseTitle}
      />
      {err && <p className="mb-2 text-red-700">{err}</p>}
      {enrollCount !== null && enrollCount > 0 && (
        <label className="mb-2 flex items-center gap-2 text-red-800">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          Xoá luôn cả {enrollCount} enrollment (cascade — chỉ dùng khi test)
        </label>
      )}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || typed !== courseTitle}
          className="btn-sm rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
        >
          {busy ? "Đang xoá..." : "Xoá vĩnh viễn"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTyped("");
            setErr(null);
            setForce(false);
            setEnrollCount(null);
          }}
          disabled={busy}
          className="btn-secondary btn-sm"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
