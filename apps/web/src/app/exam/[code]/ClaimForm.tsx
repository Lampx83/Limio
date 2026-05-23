"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";

type Mode = "open" | "assigned";

type Stage =
  | { kind: "form" }
  | {
      kind: "confirm";
      cohort: { id: string; name: string; instructorName: string | null };
    };

export default function ClaimForm({
  code,
  mode,
  candidateName,
  courseId,
}: {
  code: string;
  mode: Mode;
  candidateName: string | null;
  courseId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "form" });

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [cohortCode, setCohortCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [_hp, setHp] = useState("");

  const submitClaim = async (cohortId: string | null) => {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { code, _hp };
      if (mode === "open") {
        body.displayName = displayName.trim();
        body.phone = phone.trim();
        body.email = email.trim();
        if (studentCode.trim()) body.studentCode = studentCode.trim();
        if (cohortId) body.cohortId = cohortId;
        if (roomCode.trim()) body.roomCode = roomCode.trim().toUpperCase();
      }
      const res = await fetch("/api/public/exam/claim-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(humanizeError(j?.error ?? `HTTP ${res.status}`));
        setStage({ kind: "form" });
        return;
      }
      const j = (await res.json()) as { attemptId: string };
      router.replace(`/exam-take/${j.attemptId}`);
    } catch {
      setErr("Lỗi mạng — thử lại");
      setStage({ kind: "form" });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    // Assigned mode: no cohort step.
    if (mode === "assigned") {
      await submitClaim(null);
      return;
    }

    // Open mode without cohort code: skip preview.
    const cohortInput = cohortCode.trim();
    if (!cohortInput || !courseId) {
      await submitClaim(null);
      return;
    }

    // Preview the cohort before claiming.
    setBusy(true);
    try {
      const res = await fetch("/api/public/exam/preview-cohort", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, cohortCode: cohortInput }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(humanizeError(j?.error ?? `HTTP ${res.status}`));
        return;
      }
      const j = (await res.json()) as {
        cohort: { id: string; name: string; instructorName: string | null };
      };
      setStage({ kind: "confirm", cohort: j.cohort });
    } catch {
      setErr("Lỗi mạng — thử lại");
    } finally {
      setBusy(false);
    }
  };

  if (stage.kind === "confirm") {
    return (
      <div
        data-testid="cohort-confirm"
        className="mt-6 space-y-4 rounded-lg border border-blue-300 bg-blue-50 p-5"
      >
        <h2 className="text-sm font-semibold text-blue-900">Xác nhận lớp học</h2>
        <p className="text-sm text-slate-700">
          Bạn sắp vào thi với tư cách:
        </p>
        <div className="rounded border border-blue-200 bg-white p-4">
          <div className="text-base font-semibold">{stage.cohort.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" /> GV phụ trách:{" "}
            {stage.cohort.instructorName ?? (
              <span className="text-faint">(chưa gán)</span>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-600">
          Sai? Bấm <strong>Sửa</strong> để quay lại nhập đúng mã lớp. Kết quả thi
          sẽ được gửi về GV của lớp này.
        </p>
        {err && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStage({ kind: "form" })}
            disabled={busy}
            className="flex-1 rounded border border-default bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            ← Sửa
          </button>
          <button
            type="button"
            onClick={() => submitClaim(stage.cohort.id)}
            disabled={busy}
            className="flex-1 rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Đang vào..." : "Xác nhận → Bắt đầu thi"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="claim-form"
      className="mt-6 space-y-4 rounded-lg border border-default bg-white p-5 shadow-sm"
    >
      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        value={_hp}
        onChange={(e) => setHp(e.target.value)}
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
        aria-hidden
      />

      <div>
        <label className="block text-xs font-medium text-slate-600">Mã thi</label>
        <div className="mt-1 rounded bg-slate-100 px-3 py-2 font-mono text-lg tracking-widest text-slate-900">
          {code}
        </div>
      </div>

      {mode === "assigned" && (
        <div data-testid="assigned-confirm">
          <label className="block text-xs font-medium text-slate-600">Thí sinh</label>
          <div className="mt-1 rounded border border-default bg-slate-50 px-3 py-2 text-base font-medium">
            {candidateName}
          </div>
          <p className="mt-1 text-xs text-faint">
            Nếu thông tin không đúng, liên hệ giám thị trước khi tiếp tục.
          </p>
        </div>
      )}

      {mode === "open" && (
        <>
          <Field
            label="Họ tên"
            required
            value={displayName}
            onChange={setDisplayName}
            placeholder="Nguyễn Văn A"
            maxLength={200}
          />
          <Field
            label="Mã sinh viên"
            required
            value={studentCode}
            onChange={setStudentCode}
            placeholder="K65-001"
            maxLength={50}
          />
          <Field
            label="Email"
            required
            value={email}
            onChange={setEmail}
            placeholder="ban@example.com"
            inputMode="email"
            maxLength={200}
          />
          <Field
            label="Số điện thoại"
            required
            value={phone}
            onChange={setPhone}
            placeholder="09xxxxxxxx"
            inputMode="tel"
            maxLength={20}
          />
          <Field
            label="Mã lớp học"
            value={cohortCode}
            onChange={(v) => setCohortCode(v.toUpperCase())}
            placeholder="K65A-T7C"
            maxLength={16}
            hint="Mã lớp do nhà trường cấp đầu kỳ. Để trống nếu không thuộc lớp nào."
            mono
          />
          <Field
            label="Mã phòng thi"
            value={roomCode}
            onChange={(v) => setRoomCode(v.toUpperCase())}
            placeholder="A3K7"
            maxLength={4}
            hint="Mã 4 ký tự do giám thị công bố. Để trống nếu giám thị không thông báo."
            mono
          />
        </>
      )}

      {err && (
        <div
          data-testid="claim-error"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Đang xử lý..." : mode === "open" && cohortCode.trim() ? "Tiếp tục →" : "Bắt đầu thi"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  maxLength,
  inputMode,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "tel" | "email";
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        className={`mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
          mono ? "font-mono uppercase" : ""
        }`}
      />
      {hint && <span className="mt-0.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

function humanizeError(code: string): string {
  const map: Record<string, string> = {
    invalid_code: "Mã thi không hợp lệ hoặc đã hết hạn.",
    candidate_name_required: "Vui lòng nhập họ tên.",
    candidate_phone_required: "Số điện thoại không hợp lệ (9-11 số).",
    candidate_email_required: "Email không hợp lệ.",
    exam_not_open: "Ca thi chưa mở.",
    exam_window_closed: "Ca thi đã đóng.",
    access_mode_mismatch: "Mã không thuộc ca thi đang mở.",
    open_max_attempts_reached: "Ca thi đã đủ số lượng thí sinh tối đa.",
    candidate_disabled: "Tài khoản thí sinh đã bị vô hiệu hoá. Liên hệ giám thị.",
    attempt_already_submitted: "Bài thi đã được nộp trước đó.",
    rate_limited: "Quá nhiều lần thử. Vui lòng chờ vài phút rồi thử lại.",
    cohort_not_found: "Mã lớp không tồn tại. Kiểm tra lại với GV.",
    invalid_room_code: "Mã phòng thi không đúng. Kiểm tra lại với giám thị.",
  };
  return map[code] ?? `Lỗi: ${code}`;
}
