"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { tournamentErrorMessage } from "@/lib/tournamentText";
import AssignmentSubmitForm from "@/components/AssignmentSubmitForm";
import { FILE_TYPES } from "@/lib/tournamentMissionForm";

type VerifyMode = "AUTO_GRADE" | "AUTO_CHECK" | "PEER_REVIEW" | "MANUAL_REVIEW";

export default function MissionSubmitForm({
  missionId,
  verifyMode,
  quizId,
  assignmentId,
  submissionDeadlineIso,
  hackathonMode = false,
}: {
  missionId: string;
  verifyMode: VerifyMode;
  quizId: string | null;
  assignmentId: string | null;
  submissionDeadlineIso: string | null;
  hackathonMode?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AUTO_CHECK payloads.
  const [url, setUrl] = useState("");
  const [fileMime, setFileMime] = useState("");
  // PEER_REVIEW payload.
  const [artifact, setArtifact] = useState("");
  // Hackathon multi-artifact payload (for PEER_REVIEW/MANUAL_REVIEW collective).
  const [repoUrl, setRepoUrl] = useState("");
  const [slidesUrl, setSlidesUrl] = useState("");
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [writeup, setWriteup] = useState("");

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
        Nhiệm vụ này là bài kiểm tra tự chấm.{" "}
        {quizId ? (
          <a href={`/quizzes/${quizId}/attempt?missionId=${missionId}`} className="link">
            Bắt đầu làm bài →
          </a>
        ) : (
          <span className="text-warning-700">Giảng viên chưa thêm câu hỏi nên bạn chưa làm được.</span>
        )}
      </div>
    );
  }

  if (verifyMode === "MANUAL_REVIEW" && !hackathonMode) {
    if (!assignmentId) {
      return (
        <p className="text-sm text-warning-700">
          Giảng viên chưa thiết lập xong phần nộp bài cho nhiệm vụ này.
        </p>
      );
    }
    return (
      <div>
        <p className="mb-3 text-xs text-muted">
          Giảng viên sẽ chấm bài của bạn. Nộp bài ở form bên dưới:
        </p>
        <AssignmentSubmitForm assignmentId={assignmentId} />
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(tournamentErrorMessage(data, "Nộp bài chưa được. Vui lòng thử lại."));
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
          <label className="label text-xs">Liên kết bài làm (nếu nhiệm vụ yêu cầu nộp liên kết)</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="input mt-1 text-sm"
          />
        </div>
        <div>
          <label className="label text-xs">Loại tệp bài làm (nếu nhiệm vụ yêu cầu nộp tệp)</label>
          <select
            value={fileMime}
            onChange={(e) => setFileMime(e.target.value)}
            className="select mt-1 text-sm"
          >
            <option value="">Không nộp tệp</option>
            {FILE_TYPES.map((t) => (
              <option key={t.id} value={t.mime[0]}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang nộp..." : "Nộp"}
        </button>
      </form>
    );
  }

  // Hackathon mode: multi-artifact form for any review-based verify mode.
  if (hackathonMode && (verifyMode === "PEER_REVIEW" || verifyMode === "MANUAL_REVIEW")) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({
            hackathon: true,
            repoUrl: repoUrl.trim() || undefined,
            slidesUrl: slidesUrl.trim() || undefined,
            demoVideoUrl: demoVideoUrl.trim() || undefined,
            writeup: writeup.trim() || undefined,
            // Keep legacy artifact field populated with a summary so existing
            // PEER_REVIEW review UI still has something to render.
            artifactMarkdown:
              `**Repo:** ${repoUrl || "—"}\n` +
              `**Slides:** ${slidesUrl || "—"}\n` +
              `**Demo:** ${demoVideoUrl || "—"}\n\n` +
              (writeup || ""),
          });
        }}
        className="space-y-3"
      >
        <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          Nộp bài của đội gồm 4 phần (mã nguồn, slide, video demo, mô tả). Phần nào cũng không bắt buộc, càng đầy đủ càng dễ chấm.
        </p>
        <div>
          <label className="label text-xs">🔗 Repo code</label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/team/project"
            className="input mt-1 text-sm"
          />
        </div>
        <div>
          <label className="label text-xs">🎞️ Slides / Deck</label>
          <input
            type="url"
            value={slidesUrl}
            onChange={(e) => setSlidesUrl(e.target.value)}
            placeholder="Canva / Google Slides / Figma / Notion..."
            className="input mt-1 text-sm"
          />
          <p className="mt-0.5 text-[11px] text-faint">
            Bất kỳ URL nào: Canva, Google Slides, Figma, Notion, OneDrive...
          </p>
        </div>
        <div>
          <label className="label text-xs">🎥 Demo video</label>
          <input
            type="url"
            value={demoVideoUrl}
            onChange={(e) => setDemoVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="input mt-1 text-sm"
          />
        </div>
        <div>
          <label className="label text-xs">📝 Mô tả ngắn (writeup)</label>
          <textarea
            value={writeup}
            onChange={(e) => setWriteup(e.target.value)}
            rows={5}
            placeholder="Vấn đề giải quyết · cách tiếp cận · điểm độc đáo · roadmap..."
            className="input mt-1 text-sm"
          />
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang nộp..." : "Nộp project"}
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
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang nộp..." : "Nộp"}
        </button>
      </form>
    );
  }

  return null;
}
