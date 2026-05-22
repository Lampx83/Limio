"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

type VerifyMode = "AUTO_GRADE" | "AUTO_CHECK" | "PEER_REVIEW" | "MANUAL_REVIEW";

export default function MissionSubmitForm({
  missionId,
  verifyMode,
  quizId,
  assignmentId,
  submissionDeadlineIso,
}: {
  missionId: string;
  verifyMode: VerifyMode;
  quizId: string | null;
  assignmentId: string | null;
  submissionDeadlineIso: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AUTO_CHECK payloads.
  const [url, setUrl] = useState("");
  const [fileMime, setFileMime] = useState("");
  // PEER_REVIEW payload.
  const [artifact, setArtifact] = useState("");

  const pastDeadline = submissionDeadlineIso
    ? new Date() >= new Date(submissionDeadlineIso)
    : false;

  if (pastDeadline) {
    return (
      <p className="text-sm text-danger-600">Hết hạn nộp.</p>
    );
  }

  if (verifyMode === "AUTO_GRADE") {
    return (
      <div className="text-sm text-muted">
        Mission này dùng quiz tự chấm.{" "}
        {quizId ? (
          <a href={`/quizzes/${quizId}/attempt?missionId=${missionId}`} className="link">
            Bắt đầu làm quiz →
          </a>
        ) : (
          <span className="text-warning-700">Giảng viên chưa tạo câu hỏi.</span>
        )}
      </div>
    );
  }

  if (verifyMode === "MANUAL_REVIEW") {
    return (
      <div className="text-sm text-muted">
        Mission này do giảng viên chấm tay.{" "}
        {assignmentId ? (
          <a href={`/assignments/${assignmentId}`} className="link">
            Mở form nộp bài →
          </a>
        ) : (
          <span className="text-warning-700">Giảng viên chưa cấu hình Assignment.</span>
        )}
      </div>
    );
  }

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/tournament-missions/${missionId}/submit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "submit_failed");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (verifyMode === "AUTO_CHECK") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Send both — backend picks based on rule type.
          submit({ url, fileMime });
        }}
        className="space-y-3"
      >
        <div>
          <label className="label text-xs">Đường dẫn proof (nếu rule URL pattern)</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="input mt-1 text-sm"
          />
        </div>
        <div>
          <label className="label text-xs">MIME type (nếu rule file_format)</label>
          <input
            value={fileMime}
            onChange={(e) => setFileMime(e.target.value)}
            placeholder="application/pdf"
            className="input mt-1 text-sm"
          />
        </div>
        {error && <p className="text-sm text-danger-600">Lỗi: {error}</p>}
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang nộp..." : "Nộp"}
        </button>
      </form>
    );
  }

  if (verifyMode === "PEER_REVIEW") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({ artifactMarkdown: artifact });
        }}
        className="space-y-3"
      >
        <div>
          <label className="label text-xs">Bài làm (markdown)</label>
          <textarea
            value={artifact}
            onChange={(e) => setArtifact(e.target.value)}
            rows={10}
            required
            placeholder="Nộp bài viết / link / mô tả..."
            className="input mt-1 text-sm font-mono"
          />
        </div>
        <p className="text-xs text-faint">
          Sau hạn nộp, hệ thống chia ngẫu nhiên 3 bạn cùng đợt chấm. Có thể sửa
          trước khi có review đầu tiên.
        </p>
        {error && <p className="text-sm text-danger-600">Lỗi: {error}</p>}
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang nộp..." : "Nộp"}
        </button>
      </form>
    );
  }

  return null;
}
