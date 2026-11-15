"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import AudioRecorder from "@/components/AudioRecorder";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import {
  GENERATIVE_PRESETS,
  SPEAKING_BODY_PLACEHOLDER,
  acceptForFormat,
  requiresUpload,
  type GenerativeActivityType,
  type ResponseFormat,
} from "@/lib/generativeActivity";
import { useT } from "@/lib/i18n/client";

const REFLECTION_MIN_CHARS = 20;

export default function AssignmentSubmitForm({
  assignmentId,
  pedagogicalIntent = null,
  responseFormat = "text",
  requireSelfRating = false,
  requireReflection = false,
  teamMode = false,
  teamName = null,
  alreadyGraded = false,
}: {
  assignmentId: string;
  pedagogicalIntent?: GenerativeActivityType | null;
  responseFormat?: ResponseFormat;
  requireSelfRating?: boolean;
  requireReflection?: boolean;
  /** Bài tập nộp theo nhóm: một người nộp là cả nhóm có bài (docs/group-submission-AC.md C2, C5). */
  teamMode?: boolean;
  teamName?: string | null;
  /** Bài nhóm đã chấm — nộp lại sẽ đưa cả nhóm về chưa chấm, nên hỏi xác nhận trước. */
  alreadyGraded?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [selfRating, setSelfRating] = useState<number | "">("");
  const [reflection, setReflection] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const needUpload = requiresUpload(responseFormat);

  // LANG G7 — bài nói: ghi âm ngay trong trang; chữ ghi chú không bắt buộc (bản ghi là bài làm).
  const isSpeaking = responseFormat === "audio";

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    await uploadFile(f);
  }

  async function uploadFile(f: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(
        apiUrl(`/api/assignments/submissions/upload`),
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(t("practice.asg.uploadFailed"), {
          description: d.error ?? t("practice.asg.tryAgain"),
        });
      } else {
        const d = (await res.json()) as { url: string };
        // d.url là đường dẫn API của Next (/api/assignment-media/...), nên
        // nó cũng cần tiền tố như mọi đường dẫn nội bộ khác.
        const absolute = shareUrl(d.url);
        setAttachmentUrl(absolute);
        toast.success(t("practice.asg.uploaded"));
      }
    } finally {
      setUploading(false);
    }
  }

  const promptHint = pedagogicalIntent
    ? GENERATIVE_PRESETS[pedagogicalIntent].promptTemplate
    : null;

  function reset() {
    setBody("");
    setAttachmentUrl("");
    setSelfRating("");
    setReflection("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requireSelfRating && selfRating === "") {
      toast.error(t("practice.asg.needRating"));
      return;
    }
    if (requireReflection && reflection.trim().length < REFLECTION_MIN_CHARS) {
      toast.error(t("practice.asg.reflectionMin", { n: REFLECTION_MIN_CHARS }));
      return;
    }
    if (needUpload && !attachmentUrl.trim()) {
      toast.error(t("practice.asg.needUpload"));
      return;
    }
    if (
      teamMode &&
      alreadyGraded &&
      !window.confirm(t("practice.asg.confirmResubmit"))
    ) {
      return;
    }
    setBusy(true);
    const payload: Record<string, unknown> = {
      body: body.trim() || (isSpeaking ? SPEAKING_BODY_PLACEHOLDER : body),
      attachmentUrl: attachmentUrl.trim() || null,
    };
    if (selfRating !== "") payload.selfRating = Number(selfRating);
    if (reflection.trim()) payload.reflection = reflection.trim();

    const res = await fetch(apiUrl(`/api/assignments/${assignmentId}/submit`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(t("practice.asg.submitted"), {
        description: teamMode
          ? t("practice.asg.okTeam")
          : pedagogicalIntent
            ? t("practice.asg.okFeedback")
            : t("practice.asg.okWait"),
      });
      reset();
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(t("practice.asg.failed"), {
        description:
          d.error === "no_team"
            ? t("practice.asg.noTeam")
            : (d.error ?? t("practice.asg.tryAgain")),
      });
      if (d.error === "no_team") router.refresh();
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        {t("practice.asg.open")}
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3"
    >
      {teamMode && (
        <p className="text-xs text-muted">
          {teamName ? <>{t("practice.asg.teamPre")}<span className="font-semibold">{teamName}</span>. </> : null}
          {t("practice.asg.teamOne")}
        </p>
      )}
      {promptHint && (
        <p className="rounded-lg border border-brand-200 bg-brand-soft p-2 text-xs text-brand-700">
          💡 {promptHint}
        </p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required={!isSpeaking}
        rows={isSpeaking ? 2 : 6}
        placeholder={isSpeaking ? t("practice.asg.notePh") : t("practice.asg.bodyPh")}
        className="textarea"
      />
      {isSpeaking && <AudioRecorder onRecorded={(f) => void uploadFile(f)} disabled={uploading} />}
      {needUpload && (
        <div className="space-y-1 rounded-lg border border-token bg-[rgb(var(--surface))] p-2">
          <span className="text-xs font-medium text-default">
            {pedagogicalIntent
              ? GENERATIVE_PRESETS[pedagogicalIntent].uploadLabel
              : t("practice.asg.uploadLabel")}
            <span className="text-danger-600"> *</span>
          </span>
          <input
            type="file"
            accept={acceptForFormat(responseFormat)}
            onChange={onPickFile}
            disabled={uploading}
            className="block w-full text-xs"
          />
          {attachmentUrl && (
            <p className="text-xs text-success-700">
              {t("practice.asg.uploadedLabel")}{" "}
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener"
                className="link"
              >
                {t("practice.asg.viewFile")}
              </a>
            </p>
          )}
        </div>
      )}
      <input
        value={attachmentUrl}
        onChange={(e) => setAttachmentUrl(e.target.value)}
        type="url"
        placeholder={
          needUpload
            ? t("practice.asg.urlPhUpload")
            : t("practice.asg.urlPh")
        }
        className="input text-xs"
      />
      {/google\.com\//i.test(attachmentUrl) && (
        <p className="banner-warning text-xs">
          {t("practice.asg.shareWarn")}
        </p>
      )}

      {(requireSelfRating || requireReflection) && (
        <div className="space-y-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
          {requireSelfRating && (
            <label className="block">
              <span className="text-xs font-medium text-default">
                {t("practice.asg.selfRatingQ")}
                <span className="text-danger-600"> *</span>
              </span>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelfRating(n)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                      selfRating === n
                        ? "border-brand-500 bg-brand-soft text-brand-700"
                        : "border-token bg-[rgb(var(--surface-muted))] text-muted hover:border-brand-300"
                    }`}
                    aria-pressed={selfRating === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-xs text-faint">
                {t("practice.asg.selfRatingScale")}
              </span>
            </label>
          )}
          {requireReflection && (
            <label className="block">
              <span className="text-xs font-medium text-default">
                {t("practice.asg.reflectionQ")}
                <span className="text-danger-600"> *</span>
              </span>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                minLength={REFLECTION_MIN_CHARS}
                placeholder={t("practice.asg.reflectionPh")}
                className="textarea mt-1 text-sm"
              />
              <span className="mt-1 block text-xs text-faint">
                {t("practice.asg.chars", { c: reflection.trim().length, m: REFLECTION_MIN_CHARS })}
              </span>
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : t("practice.asg.submit")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary btn-sm"
        >
          {t("practice.asg.cancel")}
        </button>
      </div>
      <p className="text-xs text-faint">
        {teamMode
          ? t("practice.asg.overwriteTeam")
          : t("practice.asg.overwrite")}
      </p>
    </form>
  );
}
