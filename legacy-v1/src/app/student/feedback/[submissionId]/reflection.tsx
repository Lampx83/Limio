"use client";

import { useEffect, useState } from "react";

export default function MetacogReflection({
  submissionId,
  prompt,
}: {
  submissionId: number;
  prompt: string;
}) {
  const [reflection, setReflection] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "feedback_view",
        payload: { submission_id: submissionId },
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (reflection.trim().length < 20) return;
    setSaving(true);
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "feedback_metacog_response",
        payload: { submission_id: submissionId, reflection },
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!prompt) return null;

  return (
    <div className="card p-5 border-amber-300 bg-amber-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="badge bg-amber-200 text-amber-900">Tự suy ngẫm</span>
        <h3 className="font-semibold">Câu hỏi siêu nhận thức</h3>
      </div>
      <p className="text-sm text-slate-800 mb-3 italic">{prompt}</p>
      {saved ? (
        <div className="text-sm text-emerald-700">
          ✓ Cảm ơn, suy ngẫm của bạn đã được ghi lại.
        </div>
      ) : (
        <>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Hãy viết 2-4 câu trả lời câu hỏi này (tối thiểu 20 ký tự)..."
            className="w-full min-h-[100px] rounded border border-amber-300 p-2 text-sm bg-white"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={save}
              disabled={reflection.trim().length < 20 || saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Gửi suy ngẫm"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
