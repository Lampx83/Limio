"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Chế độ thi" card on the session detail page. Drives Exam.accessMode +
 * openCode through the existing /api/exams/[id]/access endpoint. Backend
 * auto-generates openCode when switching to open_code mode.
 *
 * Caveat: accessMode lives on Exam (not Session) for now, so this card
 * affects ALL sessions of the exam. If 2 sessions of the same exam are
 * displayed at once, both will update on change.
 */
export default function ExamAccessModeCard({
  examId,
  accessMode,
  openCode,
  assignedCodeSource,
  baseUrl,
  canEdit,
}: {
  examId: string;
  accessMode: string;
  openCode: string | null;
  assignedCodeSource: "random" | "student_code";
  baseUrl: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const switchMode = async (next: "assigned_code" | "open_code") => {
    if (busy || next === accessMode) return;
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/exams/${examId}/access`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessMode: next }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const switchAssignedSource = async (next: "random" | "student_code") => {
    if (busy || next === assignedCodeSource) return;
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/exams/${examId}/access`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignedCodeSource: next }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const rotateCode = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/access/rotate`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!openCode) return;
    try {
      await navigator.clipboard.writeText(openCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  // State A: unconfigured (authenticated) — show 2-button picker
  if (accessMode === "authenticated") {
    return (
      <section className="rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="text-base font-semibold text-amber-900">
          🎯 Chọn cách tổ chức thi
        </h2>
        <p className="mt-1 text-xs text-amber-800">
          Đề thi chưa được setup chế độ. Chọn 1 trong 2:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeButton
            title="📚 Theo phòng"
            desc="Có danh sách thí sinh cụ thể, in mã riêng từng phòng (thi cuối kỳ, có roster)."
            onClick={() => switchMode("assigned_code")}
            disabled={!canEdit || busy}
          />
          <ModeButton
            title="🎫 Tự do"
            desc="1 mã chung cho cả lớp, sinh viên tự nhập tên khi vào (quiz, practice, test trên lớp)."
            onClick={() => switchMode("open_code")}
            disabled={!canEdit || busy}
          />
        </div>
        {err && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}
      </section>
    );
  }

  // State B: assigned_code — show summary + offer "switch back to free-form"
  if (accessMode === "assigned_code") {
    return (
      <section className="rounded-lg border border-default bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              📚 Chế độ thi: <span className="text-blue-700">Theo phòng</span>
            </h2>
            <p className="mt-1 text-xs text-faint">
              Mỗi thí sinh có mã thi riêng được gán vào phòng cụ thể. Quản lý
              phòng + thí sinh ở tab &quot;Phòng thi&quot;.
            </p>

            <div className="mt-4 rounded border border-default bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-700">
                Nguồn mã access cho thí sinh
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <SourceButton
                  active={assignedCodeSource === "random"}
                  onClick={() => switchAssignedSource("random")}
                  disabled={!canEdit || busy}
                  title="🎲 Ngẫu nhiên"
                  desc="8 ký tự, hệ thống tự sinh"
                />
                <SourceButton
                  active={assignedCodeSource === "student_code"}
                  onClick={() => switchAssignedSource("student_code")}
                  disabled={!canEdit || busy}
                  title="🎓 MSSV"
                  desc="Mã access = MSSV của SV"
                />
              </div>
              {assignedCodeSource === "student_code" && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  ⚠ MSSV dễ đoán hơn mã ngẫu nhiên. Chỉ dùng khi ca thi có giám
                  thị vật lý kiểm tra thẻ.
                </div>
              )}
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => {
                if (window.confirm(
                  "Đổi sang chế độ Tự do? Mã cá nhân của các thí sinh sẽ bị huỷ và mất tác dụng.",
                ))
                  switchMode("open_code");
              }}
              disabled={busy}
              className="shrink-0 rounded border border-default px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
            >
              Đổi sang Tự do
            </button>
          )}
        </div>
        {err && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}
      </section>
    );
  }

  // State C: open_code — show common code + URL
  if (accessMode === "open_code") {
    const examUrl = openCode ? `${baseUrl}/thi` : "";
    return (
      <section className="rounded-lg border border-default bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              🎫 Chế độ thi: <span className="text-emerald-700">Tự do</span>
            </h2>
            <p className="mt-1 text-xs text-faint">
              1 mã chung cho cả lớp. Sinh viên gõ URL bên dưới + mã thi để vào
              thi.
            </p>

            {openCode ? (
              <div className="mt-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="text-xs font-medium text-slate-600">
                  Mã thi chung
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="rounded bg-slate-900 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-amber-300">
                    {openCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                  >
                    {copied ? "✓ Đã copy" : "📋 Copy mã"}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => {
                        if (window.confirm("Sinh mã mới? Mã cũ sẽ ngừng hoạt động."))
                          rotateCode();
                      }}
                      disabled={busy}
                      className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      🔄 Sinh mã mới
                    </button>
                  )}
                </div>
                <div className="mt-3 text-xs text-slate-600">
                  Sinh viên vào URL:{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm font-semibold text-blue-700">
                    {examUrl}
                  </code>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Chưa có mã chung — bấm nút bên dưới để sinh.
                {canEdit && (
                  <button
                    onClick={rotateCode}
                    disabled={busy}
                    className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Sinh mã
                  </button>
                )}
              </div>
            )}
          </div>
          {canEdit && (
            <button
              onClick={() => {
                if (window.confirm(
                  "Đổi sang chế độ Theo phòng? Mã chung sẽ bị huỷ.",
                ))
                  switchMode("assigned_code");
              }}
              disabled={busy}
              className="shrink-0 rounded border border-default px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
            >
              Đổi sang Theo phòng
            </button>
          )}
        </div>
        {err && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}
      </section>
    );
  }

  return null;
}

function SourceButton({
  active,
  onClick,
  disabled,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
          : "border-default bg-white hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-0.5 text-[11px] text-faint">{desc}</div>
    </button>
  );
}

function ModeButton({
  title,
  desc,
  onClick,
  disabled,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border-2 border-amber-300 bg-white px-4 py-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-600">{desc}</div>
      <div className="mt-2 text-xs font-medium text-blue-600">Chọn →</div>
    </button>
  );
}
