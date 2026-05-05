"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function DuplicateCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    if (!confirm("Tạo bản copy của khóa này (status=draft)? Modules + lessons + quizzes + assignments + skill tags sẽ được clone, KHÔNG clone enrollments / attempts.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(apiUrl(`/api/courses/${courseId}/duplicate`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      router.push(`/instructor/courses/${d.courseId}`);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(`Duplicate thất bại: ${d.error ?? "unknown"}`);
    }
  }

  return (
    <button onClick={duplicate} disabled={busy} className="btn-secondary btn-sm">
      {busy ? "..." : "Duplicate"}
    </button>
  );
}
