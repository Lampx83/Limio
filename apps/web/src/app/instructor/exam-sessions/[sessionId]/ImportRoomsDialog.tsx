"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

type Field =
  | "examClassCode"
  | "cohortCode"
  | "instructorEmail"
  | "roomLocation"
  | "proctorEmail"
  | "stt"
  | "displayName"
  | "email"
  | "mssv";

type Row = Partial<Record<Field, string>> & { line: number };

/** Bỏ dấu, hạ chữ thường, gộp mọi ký tự không phải chữ/số thành một dấu cách. */
const norm = (h: string) =>
  h
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Tên cột chấp nhận (đã chuẩn hoá). "email" trơn là email thí sinh; email giảng
// viên / giám thị phải nói rõ để khỏi nhầm.
const HEADERS: Record<Field, string[]> = {
  examClassCode: ["ma lop thi", "lop thi", "phong", "phong thi", "ten phong", "room", "exam class", "examclass", "ma phong"],
  cohortCode: ["ma lop hoc", "lop hoc", "lop", "cohort", "cohort code", "ma lop"],
  instructorEmail: ["email gv", "email giang vien", "gv", "giang vien", "instructor", "instructor email"],
  roomLocation: ["dia diem", "dia diem thi", "location", "room location"],
  proctorEmail: ["email giam thi", "giam thi", "proctor", "proctor email"],
  stt: ["stt", "so thu tu", "no"],
  displayName: ["ho ten", "ho va ten", "ten", "ten thi sinh", "name", "full name", "display name"],
  email: ["email", "email thi sinh", "email sv", "email sinh vien"],
  mssv: ["mssv", "ma sv", "ma sinh vien", "student id", "student code", "ma so sinh vien"],
};

const FIELD_LABEL: Record<Field, string> = {
  examClassCode: "Mã lớp thi / phòng",
  cohortCode: "Mã lớp học",
  instructorEmail: "Email GV",
  roomLocation: "Địa điểm",
  proctorEmail: "Email giám thị",
  stt: "STT",
  displayName: "Họ tên",
  email: "Email TS",
  mssv: "MSSV",
};

const SAMPLE =
  "mã lớp học\temail GV\tmã lớp thi\tđịa điểm\temail giám thị\tSTT\thọ tên\temail\tMSSV\n" +
  "K65A\tgv@truong.edu.vn\tP101\tNhà A1\tgt1@truong.edu.vn\t1\tNguyễn Văn An\tan@sv.edu.vn\t11001\n" +
  "K65A\t\tP101\t\t\t\tTrần Thị Bình\t\t11002";

function parse(raw: string): { rows: Row[]; fields: Field[]; errors: string[] } {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], fields: [], errors: [] };
  const delim = lines[0]!.includes("\t") ? "\t" : lines[0]!.includes(";") ? ";" : ",";
  const split = (l: string) => l.split(delim).map((c) => c.trim());

  const headCells = split(lines[0]!).map(norm);
  const colField: (Field | null)[] = headCells.map((h) => {
    for (const f of Object.keys(HEADERS) as Field[]) if (HEADERS[f].includes(h)) return f;
    return null;
  });
  const fields = Array.from(new Set(colField.filter((f): f is Field => f !== null)));
  const errors: string[] = [];
  if (!fields.includes("examClassCode"))
    errors.push(
      'Dòng đầu phải là tiêu đề cột và có cột "mã lớp thi" (hoặc "phòng"). Dán cả dòng tiêu đề khi copy từ Excel.',
    );

  const rows: Row[] = lines.slice(1).map((l, i) => {
    const cells = split(l);
    const r: Row = { line: i + 2 };
    colField.forEach((f, c) => {
      if (f && cells[c]) r[f] = cells[c];
    });
    return r;
  });
  return { rows, fields, errors };
}

type Result = {
  roomsCreated: number;
  roomsUpdated: number;
  cohortsCreated: number;
  cohortsUpdated: number;
  examClassesCreated: number;
  candidatesAdded: number;
  candidatesSkipped: number;
  invited: number;
  cohortLayerSkipped: boolean;
  skipped: Array<{ row: number; reason: string; detail?: string }>;
};

const REASON: Record<string, string> = {
  missing_room_code: "Thiếu mã lớp thi / phòng",
  invalid_proctor_email: "Email giám thị không hợp lệ",
  invalid_gv_email: "Email giảng viên không hợp lệ",
  exam_class_owned_by_other_cohort: "Mã lớp thi này đã thuộc lớp học khác",
  validation_failed: "Dữ liệu thí sinh không hợp lệ",
};

export default function ImportRoomsDialog({
  sessionId,
  onClose,
  onDone,
}: {
  sessionId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const parsed = useMemo(() => parse(raw), [raw]);
  const roomCount = new Set(
    parsed.rows.map((r) => r.examClassCode?.toUpperCase()).filter(Boolean),
  ).size;
  const candCount = parsed.rows.filter((r) => r.displayName).length;
  const canSubmit = parsed.errors.length === 0 && parsed.rows.length > 0 && !busy;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/exam-sessions/${sessionId}/import`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: parsed.rows.map((r) => ({
            examClassCode: r.examClassCode ?? "",
            cohortCode: r.cohortCode ?? null,
            instructorEmail: r.instructorEmail ?? null,
            roomLocation: r.roomLocation ?? null,
            proctorEmail: r.proctorEmail ?? null,
            stt: r.stt && /^\d+$/.test(r.stt) ? Number(r.stt) : null,
            displayName: r.displayName ?? null,
            email: r.email ?? null,
            mssv: r.mssv ?? null,
          })),
        }),
      });
      const j = (await res.json().catch(() => null)) as (Result & { error?: string; details?: { reason?: string } }) | null;
      if (!res.ok || !j) {
        setErr(
          j?.details?.reason === "too_many_rows"
            ? "Tối đa 2.000 dòng mỗi lần nhập. Chia nhỏ danh sách rồi nhập từng phần."
            : j?.error === "forbidden"
              ? "Bạn không có quyền sửa ca này."
              : "Không nhập được. Vui lòng thử lại.",
        );
        return;
      }
      setResult(j);
    } catch {
      setErr("Mất kết nối khi nhập. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-rooms-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) result ? onDone() : onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-token px-5 py-3">
          <h3 id="import-rooms-title" className="text-base font-semibold">
            Nhập phòng và thí sinh từ danh sách
          </h3>
          <button
            type="button"
            onClick={result ? onDone : onClose}
            disabled={busy}
            aria-label="Đóng"
            className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {result ? (
            <ResultView result={result} />
          ) : (
            <>
              <p className="text-sm text-muted">
                Dán bảng từ Excel (cả dòng tiêu đề). Mỗi dòng là một thí sinh kèm phòng của họ; dòng
                không có họ tên chỉ tạo phòng. Cột bắt buộc duy nhất là <b>mã lớp thi</b> (chính là
                tên phòng).
              </p>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={SAMPLE}
                className="w-full rounded border border-token p-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setRaw(SAMPLE)}
                className="text-xs text-brand-700 underline"
              >
                Điền dữ liệu mẫu
              </button>

              {parsed.errors.map((e) => (
                <p key={e} className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {e}
                </p>
              ))}

              {parsed.errors.length === 0 && parsed.rows.length > 0 && (
                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  <p>
                    <b>{roomCount}</b> phòng · <b>{candCount}</b> thí sinh · {parsed.rows.length} dòng.
                  </p>
                  <p className="mt-1 text-xs">
                    Nhận diện cột:{" "}
                    {parsed.fields.map((f) => FIELD_LABEL[f]).join(", ")}.
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {!parsed.fields.includes("proctorEmail") && (
                      <li>Không có cột giám thị: bạn sẽ là giám thị của các phòng mới.</li>
                    )}
                    {!parsed.fields.includes("cohortCode") && (
                      <li>Không có cột mã lớp học: chỉ tạo phòng, không gắn lớp học.</li>
                    )}
                  </ul>
                </div>
              )}

              {err && (
                <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-token px-5 py-3">
          {result ? (
            <button
              type="button"
              onClick={onDone}
              className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Xong
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded border border-token px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? "Đang nhập…" : "Nhập vào ca"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  const stat = (n: number, label: string) =>
    n > 0 ? (
      <li>
        <b>{n}</b> {label}
      </li>
    ) : null;
  const nothing =
    result.roomsCreated + result.roomsUpdated + result.candidatesAdded === 0;
  return (
    <div className="space-y-3 text-sm">
      <p className={nothing ? "text-amber-800" : "text-emerald-800"}>
        {nothing ? "Không có gì được thêm hay cập nhật." : "Đã nhập xong."}
      </p>
      <ul className="list-disc pl-5">
        {stat(result.roomsCreated, "phòng mới")}
        {stat(result.roomsUpdated, "phòng đã có (cập nhật giám thị/địa điểm)")}
        {stat(result.candidatesAdded, "thí sinh mới")}
        {stat(result.candidatesSkipped, "thí sinh đã có trong ca, bỏ qua")}
        {stat(result.cohortsCreated, "lớp học mới")}
        {stat(result.examClassesCreated, "lớp thi mới")}
        {stat(result.invited, "người được mời qua email")}
      </ul>
      {result.cohortLayerSkipped && (
        <p className="text-xs text-faint">
          Đề này không thuộc khoá học nên không gắn lớp học.
        </p>
      )}
      {result.skipped.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="font-medium text-amber-900">
            {result.skipped.length} dòng bị bỏ qua (số dòng không tính dòng tiêu đề):
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
            {result.skipped.slice(0, 20).map((s, i) => (
              <li key={i}>
                Dòng {s.row}: {REASON[s.reason] ?? s.reason}
                {s.detail ? ` (${s.detail})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
