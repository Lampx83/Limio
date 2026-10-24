"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

interface Result {
  updatedSessions: number[];
  skipped: Array<{ sessionNo: number; reason: "taught" | "has_activity" }>;
}

const REASON: Record<string, string> = {
  taught: "đã dạy",
  has_activity: "đã có học viên xem hoặc làm bài",
};

/** Báo "giáo trình có bản mới" và cho cập nhật các buổi chưa dạy (CENTER C3.7). */
export default function PackUpdateBanner({
  courseId,
  packTitle,
  copiedVersion,
  currentVersion,
}: {
  courseId: string;
  packTitle: string;
  copiedVersion: number;
  currentVersion: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const update = async () => {
    if (!window.confirm("Thay giáo án các buổi chưa dạy bằng bản mới? Những bài thầy/cô đã sửa trong các buổi đó sẽ mất.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/plan/update`), { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as Result & { error?: string };
      if (!r.ok) {
        setError(j.error === "nothing_to_update" ? "Khoá đã ở bản mới nhất." : "Chưa cập nhật được. Thử lại sau.");
        return;
      }
      setResult(j);
      router.refresh();
    } catch {
      setError("Chưa cập nhật được vì mạng không ổn định.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="banner-success mt-4 text-sm">
        <p className="font-medium">
          Đã cập nhật {result.updatedSessions.length} buổi lên bản {currentVersion}.
        </p>
        {result.skipped.length > 0 && (
          <p className="mt-1">
            Giữ nguyên {result.skipped.length} buổi: {result.skipped.map((s) => `buổi ${s.sessionNo} (${REASON[s.reason]})`).join(", ")}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="banner-info mt-4 text-sm">
      <p>
        Giáo trình “{packTitle}” có bản mới (bản {copiedVersion} → bản {currentVersion}). Lớp đang dạy vẫn theo bản cũ cho tới khi thầy/cô cập nhật;
        chỉ các buổi chưa dạy và chưa có học viên làm bài mới bị thay.
      </p>
      {error && <p className="mt-1 text-danger-700">{error}</p>}
      <button type="button" className="btn-primary btn-sm mt-2" disabled={busy} onClick={update}>
        {busy ? "Đang cập nhật…" : "Cập nhật các buổi chưa dạy"}
      </button>
    </div>
  );
}
