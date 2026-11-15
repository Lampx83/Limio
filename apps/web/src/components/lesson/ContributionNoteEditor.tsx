"use client";

/**
 * "Phần việc của tôi" trên bài nộp nhóm (docs/group-submission-AC.md C6).
 * Mỗi thành viên tự ghi phần mình làm; lưu ô này KHÔNG đưa bài về chưa chấm.
 */
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { useT, useUiLang } from "@/lib/i18n/client";

const MAX_CHARS = 1000;

export default function ContributionNoteEditor({
  submissionId,
  initialNote,
}: {
  submissionId: string;
  initialNote: string | null;
}) {
  const t = useT();
  const numLocale = useUiLang() === "en" ? "en-US" : "vi-VN";
  const [saved, setSaved] = useState(initialNote ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = note.trim() !== saved.trim();
  const tooLong = note.length > MAX_CHARS;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (tooLong || !dirty) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/submissions/${submissionId}/contribution`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        setSaved(note.trim());
        setNote(note.trim());
        toast.success(t("reader.contrib.saved"));
      } else {
        toast.error(t("reader.contrib.notSaved"), { description: t("reader.contrib.retryLater") });
      }
    } catch {
      toast.error(t("reader.contrib.notSaved"), { description: t("reader.contrib.network") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="rounded-lg border border-token p-3">
      <label htmlFor={`contribution-${submissionId}`} className="label">
        {t("reader.contrib.title")}
      </label>
      <p className="text-caption mt-0.5">
        {t("reader.contrib.help")}
      </p>
      <textarea
        id={`contribution-${submissionId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder={t("reader.contrib.placeholder")}
        className="textarea mt-2 text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs tabular-nums ${tooLong ? "text-danger-600" : "text-faint"}`}>
          {note.length.toLocaleString(numLocale)}/{MAX_CHARS.toLocaleString(numLocale)} {t("reader.contrib.chars")}
        </span>
        <button type="submit" disabled={busy || !dirty || tooLong} className="btn-secondary btn-sm">
          {busy ? t("reader.contrib.saving") : t("reader.contrib.save")}
        </button>
      </div>
    </form>
  );
}
