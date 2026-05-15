"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccessMode = "authenticated" | "open_code" | "assigned_code";
type AssignedCodeSource = "random" | "student_code";

export default function AccessPanel({
  examId,
  initial,
  origin,
}: {
  examId: string;
  initial: {
    accessMode: AccessMode;
    openCode: string | null;
    openMaxAttempts: number | null;
    assignedCodeSource: AssignedCodeSource;
  };
  // Public origin shown in share URLs. Server passes window.location.origin
  // equivalent; falls back to "<your domain>" string for SSR safety.
  origin: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>(initial.accessMode);
  const [savedMode, setSavedMode] = useState<AccessMode>(initial.accessMode);
  const [openCode, setOpenCode] = useState<string | null>(initial.openCode);
  const [openMaxAttempts, setOpenMaxAttempts] = useState<string>(
    initial.openMaxAttempts?.toString() ?? "",
  );
  const [assignedCodeSource, setAssignedCodeSource] =
    useState<AssignedCodeSource>(initial.assignedCodeSource);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const modeUnsaved = mode !== savedMode;

  const ERROR_LABEL: Record<string, string> = {
    access_mode_mismatch:
      "Bạn cần nhấn “Lưu cấu hình” để áp dụng chế độ mới trước khi sinh mã.",
    exam_has_attempts:
      "Đang có lượt thi diễn ra — không đổi được chế độ truy cập.",
    validation_failed: "Dữ liệu không hợp lệ.",
    forbidden: "Bạn không có quyền chỉnh ca thi này.",
  };
  const friendly = (code: string) => ERROR_LABEL[code] ?? code;

  const flashOk = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const onSave = async () => {
    setBusy("save");
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/access`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessMode: mode,
          openMaxAttempts:
            openMaxAttempts.trim() === "" ? null : Number(openMaxAttempts),
          assignedCodeSource,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(friendly(j?.error ?? `HTTP ${r.status}`));
        return;
      }
      const j = (await r.json()) as {
        accessMode: AccessMode;
        openCode: string | null;
        openMaxAttempts: number | null;
        assignedCodeSource: AssignedCodeSource;
      };
      setMode(j.accessMode);
      setSavedMode(j.accessMode);
      setOpenCode(j.openCode);
      setOpenMaxAttempts(j.openMaxAttempts?.toString() ?? "");
      setAssignedCodeSource(j.assignedCodeSource);
      flashOk("Đã lưu");
      // Re-render server tree so siblings (CandidatesPanel) pick up the new
      // accessMode — they read it from SSR props, not from this client state.
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const onRotate = async () => {
    if (
      openCode &&
      !window.confirm("Sinh mã mới? Mã cũ sẽ ngừng hoạt động ngay.")
    )
      return;
    setBusy("rotate");
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/access/rotate`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(friendly(j?.error ?? `HTTP ${r.status}`));
        return;
      }
      const j = (await r.json()) as { openCode: string };
      setOpenCode(j.openCode);
      flashOk("Đã sinh mã mới");
    } finally {
      setBusy(null);
    }
  };

  const shareUrl =
    openCode && mode === "open_code" ? `${origin}/exam/${openCode}` : null;

  return (
    <section
      data-testid="access-panel"
      className="mt-8 rounded border border-default bg-white p-5"
    >
      <h2 className="mb-1 text-base font-semibold">Hình thức truy cập</h2>
      <p className="mb-4 text-sm text-faint">
        Cách thí sinh vào ca thi. Chế độ &ldquo;Tài khoản&rdquo; là mặc định (đăng nhập + đã enroll);
        chế độ &ldquo;Mã chung&rdquo; cho thi tự do; &ldquo;Mã cá nhân&rdquo; cho thi theo phân công.
      </p>

      <fieldset className="space-y-2">
        {(
          [
            ["authenticated", "Tài khoản", "User đăng nhập + có trong danh sách enroll"],
            ["open_code", "Mã chung (Thi tự do)", "1 mã ABCD12 share cho tất cả; SV nhập tên + SĐT + email"],
            ["assigned_code", "Mã cá nhân (Theo phân công)", "Mỗi SV 1 mã 8 ký tự; nhập mã là vào thi"],
          ] as const
        ).map(([val, label, desc]) => (
          <label
            key={val}
            className={`flex cursor-pointer items-start gap-3 rounded border p-3 ${
              mode === val
                ? "border-blue-400 bg-blue-50"
                : "border-default hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="accessMode"
              checked={mode === val}
              onChange={() => setMode(val)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-faint">{desc}</div>
            </div>
          </label>
        ))}
      </fieldset>

      {mode === "open_code" && (
        <div
          data-testid="open-code-config"
          className="mt-4 rounded border border-default bg-slate-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-faint">
                Mã thi chung
              </div>
              <div
                data-testid="open-code-display"
                className="mt-1 font-mono text-2xl tracking-[0.3em] text-slate-900"
              >
                {openCode ?? "—"}
              </div>
            </div>
            <button
              onClick={onRotate}
              disabled={busy !== null || modeUnsaved}
              title={
                modeUnsaved
                  ? "Lưu cấu hình trước khi sinh mã"
                  : undefined
              }
              className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "rotate" ? "..." : openCode ? "Sinh mã mới" : "Sinh mã"}
            </button>
          </div>

          {modeUnsaved && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Bạn vừa đổi chế độ sang “Mã chung”. Nhấn <strong>Lưu cấu hình</strong> bên dưới rồi mới sinh mã được.
            </div>
          )}

          {shareUrl && (
            <div className="mt-3">
              <div className="text-xs text-faint">URL chia sẻ:</div>
              <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs text-slate-700">
                {shareUrl}
              </code>
            </div>
          )}

          <label className="mt-4 block">
            <span className="block text-xs font-medium text-slate-600">
              Số thí sinh tối đa (để trống = không giới hạn)
            </span>
            <input
              type="number"
              min={1}
              max={10000}
              value={openMaxAttempts}
              onChange={(e) => setOpenMaxAttempts(e.target.value)}
              placeholder="Vd: 200"
              className="mt-1 w-40 rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>
      )}

      {mode === "assigned_code" && (
        <div
          data-testid="assigned-config"
          className="mt-4 space-y-3 rounded border border-default bg-slate-50 p-4 text-sm text-slate-700"
        >
          <div>
            <div className="text-xs uppercase tracking-wide text-faint">
              Nguồn mã access cho thí sinh
            </div>
            <fieldset className="mt-2 space-y-2">
              {(
                [
                  [
                    "random",
                    "Sinh ngẫu nhiên 8 ký tự",
                    "Hệ thống tự cấp mã. An toàn nhất, dùng cho mọi trường hợp.",
                  ],
                  [
                    "student_code",
                    "Dùng mã sinh viên (MSSV)",
                    "Mã access = MSSV của SV. Phải có cột studentCode khi bulk import.",
                  ],
                ] as const
              ).map(([val, label, desc]) => (
                <label
                  key={val}
                  className={`flex cursor-pointer items-start gap-2 rounded border bg-white p-2.5 ${
                    assignedCodeSource === val
                      ? "border-blue-400 bg-blue-50"
                      : "border-default hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="assignedCodeSource"
                    checked={assignedCodeSource === val}
                    onChange={() => setAssignedCodeSource(val)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-medium">{label}</div>
                    <div className="text-xs text-faint">{desc}</div>
                  </div>
                </label>
              ))}
            </fieldset>
            {assignedCodeSource === "student_code" && (
              <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ MSSV dễ đoán hơn mã ngẫu nhiên. Chỉ dùng khi ca thi có giám
                thị vật lý kiểm tra thẻ.
              </div>
            )}
          </div>
          <div className="border-t border-default pt-3">
            Quản lý danh sách thí sinh + mã cá nhân ở{" "}
            <a
              href="?tab=candidates"
              className="font-medium text-blue-600 hover:underline"
            >
              tab &ldquo;Thí sinh&rdquo;
            </a>
            .
          </div>
        </div>
      )}

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}
      {flash && (
        <div className="mt-3 text-xs text-emerald-700">{flash}</div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={onSave}
          disabled={busy !== null}
          className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy === "save" ? "..." : "Lưu cấu hình"}
        </button>
      </div>
    </section>
  );
}
