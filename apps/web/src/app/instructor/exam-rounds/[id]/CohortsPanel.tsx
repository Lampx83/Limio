"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Mail, MapPin, Trash2, Upload, Users } from "lucide-react";
import * as XLSX from "xlsx";

interface ExamClassRoom {
  roomId: string;
  sessionId: string;
  sessionCode: string | null;
  sessionTitle: string | null;
  locationNote: string | null;
  proctorUserId: string;
  proctorName: string;
  sourceRowNum: number | null;
}

interface ExamClass {
  id: string;
  code: string;
  roomLocation: string | null;
  expectedStudentCount: number | null;
  actualCandidateCount: number;
  rooms: ExamClassRoom[];
}

interface CohortData {
  id: string;
  name: string;
  code: string | null;
  instructorId: string | null;
  instructorName: string | null;
  examClasses: ExamClass[];
  memberCount: number;
  scheduleCount: number;
}

interface ParsedRow {
  line: number;
  code: string;
  instructorEmail: string;
  name: string;
  // PR2.15 — full row mode
  examClassCode?: string;
  studentCount?: number;
  roomLocation?: string;
  proctorEmail?: string;
  sessionCode?: string;
  // PR2.18 — STT cột trong Excel (user-provided)
  stt?: number;
}

interface ParseError {
  line: number;
  reason: string;
}

type Mode = "cohort_only" | "full";
type SortField =
  | "stt"
  | "examClass"
  | "cohortCode"
  | "location"
  | "session"
  | "cohortName"
  | "instructor"
  | "proctor";

interface SessionOption {
  id: string;
  code: string | null;
  title: string | null;
}

export default function CohortsPanel({
  roundId,
  courseId,
  cohorts,
  sessions,
  canEdit,
}: {
  roundId: string;
  courseId: string;
  cohorts: CohortData[];
  sessions: SessionOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pasted, setPasted] = useState("");
  const [parsed, setParsed] = useState<{
    rows: ParsedRow[];
    errors: ParseError[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    invited: number;
    skipped: Array<{ row: number; code: string; reason: string }>;
  } | null>(null);
  const [fullSummary, setFullSummary] = useState<{
    cohortsCreated: number;
    cohortsUpdated: number;
    examClassesCreated: number;
    roomsCreated: number;
  } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [importMode, setImportMode] = useState<Mode>("cohort_only");
  const [sortBy, setSortBy] = useState<SortField>("stt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const onHeaderClick = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const parsePaste = () => {
    setResult(null);
    const out: { rows: ParsedRow[]; errors: ParseError[] } = {
      rows: [],
      errors: [],
    };
    const lines = pasted.split(/\r?\n/);

    // PR2.16 — Header-based parsing. Build column→field map từ dòng đầu.
    const allLines = lines.map((l) => l.trim()).filter(Boolean);
    if (allLines.length === 0) {
      setParsed(out);
      return;
    }
    const headerCells = allLines[0]!.split(/[,;\t]/).map((s) =>
      s.trim().toLowerCase(),
    );
    const fieldByCol: (keyof ParsedRow | "_skip")[] = headerCells.map((h) =>
      mapHeader(h),
    );
    // Headers we recognize as "field present".
    const recognized = new Set(fieldByCol.filter((f) => f !== "_skip"));
    const hasHeader = recognized.size >= 1;
    // Full mode if examClass or session column was named in header.
    const fullMode =
      hasHeader &&
      (recognized.has("examClassCode") || recognized.has("sessionCode"));
    setImportMode(fullMode ? "full" : "cohort_only");

    const dataLines = hasHeader ? allLines.slice(1) : allLines;
    let lineNum = hasHeader ? 1 : 0;
    for (const raw of dataLines) {
      lineNum++;
      const line = raw.trim();
      if (!line) continue;
      const cols = line.split(/[,;\t]/).map((s) => s.trim());

      // If header was recognized, build row by header mapping.
      const get = (field: keyof ParsedRow): string => {
        if (!hasHeader) return "";
        const idx = fieldByCol.indexOf(field);
        return idx >= 0 ? cols[idx] ?? "" : "";
      };
      // Helpers to read fields. If header was recognized, use header mapping.
      // Otherwise fall back to positional (legacy cohort-only mode).
      const cohortCol = hasHeader ? get("code") : cols[0] ?? "";
      const examClassCode = hasHeader ? get("examClassCode") : "";
      const studentCountStr = hasHeader ? get("studentCount") : "";
      const sessionCode = hasHeader ? get("sessionCode") : "";
      const location = hasHeader ? get("roomLocation") : "";
      const proctorEmail = hasHeader ? get("proctorEmail") : "";
      const gvEmail = hasHeader
        ? get("instructorEmail")
        : (cols[1] ?? "");
      const cohortName = hasHeader ? get("name") : (cols[2] ?? "");
      const sttStr = hasHeader ? get("stt") : "";
      const stt =
        sttStr.trim() === ""
          ? undefined
          : Number.parseInt(sttStr.trim(), 10);

      if (!cohortCol) {
        out.errors.push({ line: lineNum, reason: "Thiếu mã lớp học" });
        continue;
      }
      if (cohortCol.length < 2 || cohortCol.length > 16) {
        out.errors.push({
          line: lineNum,
          reason: `Mã lớp học không hợp lệ: "${cohortCol}"`,
        });
        continue;
      }
      if (gvEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gvEmail)) {
        out.errors.push({
          line: lineNum,
          reason: `Email GV không hợp lệ: "${gvEmail}"`,
        });
        continue;
      }
      if (fullMode) {
        if (!examClassCode || !sessionCode) {
          out.errors.push({
            line: lineNum,
            reason: "Thiếu mã lớp thi hoặc mã kíp thi",
          });
          continue;
        }
        const studentCount =
          studentCountStr.trim() === ""
            ? undefined
            : Number.parseInt(studentCountStr.trim(), 10);
        if (
          studentCount !== undefined &&
          (Number.isNaN(studentCount) || studentCount < 0)
        ) {
          out.errors.push({
            line: lineNum,
            reason: `Số SV không hợp lệ: "${studentCountStr}"`,
          });
          continue;
        }
        if (proctorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proctorEmail)) {
          out.errors.push({
            line: lineNum,
            reason: `Email giám thị không hợp lệ: "${proctorEmail}"`,
          });
          continue;
        }
        out.rows.push({
          line: lineNum,
          code: cohortCol.toUpperCase(),
          instructorEmail: gvEmail,
          name: cohortName || cohortCol.toUpperCase(),
          examClassCode: examClassCode.toUpperCase(),
          studentCount,
          roomLocation: location,
          proctorEmail,
          sessionCode: sessionCode.toUpperCase(),
          stt: stt !== undefined && !Number.isNaN(stt) ? stt : undefined,
        });
      } else {
        out.rows.push({
          line: lineNum,
          code: cohortCol.toUpperCase(),
          instructorEmail: gvEmail,
          name: cohortName || cohortCol.toUpperCase(),
        });
      }
    }
    setParsed(out);
  };

  const submit = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    try {
      // PR2.15 — Dispatch theo mode.
      if (importMode === "full") {
        const r = await fetch(`/api/exam-rounds/${roundId}/import-full`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            rows: parsed.rows.map((r) => ({
              cohortCode: r.code,
              instructorEmail: r.instructorEmail || null,
              examClassCode: r.examClassCode || "",
              studentCount: r.studentCount ?? null,
              roomLocation: r.roomLocation || null,
              proctorEmail: r.proctorEmail || null,
              sessionCode: r.sessionCode || "",
              stt: r.stt ?? null,
            })),
          }),
        });
        const j = (await r.json().catch(() => null)) as {
          error?: string;
          cohortsCreated?: number;
          cohortsUpdated?: number;
          examClassesCreated?: number;
          roomsCreated?: number;
          invited?: number;
          skipped?: Array<{ row: number; reason: string; detail?: string }>;
        } | null;
        if (!r.ok) {
          setResult({
            created: 0,
            updated: 0,
            invited: 0,
            skipped: [{ row: 0, code: "—", reason: j?.error ?? `HTTP ${r.status}` }],
          });
          return;
        }
        setResult({
          created: (j?.cohortsCreated ?? 0) + (j?.examClassesCreated ?? 0) + (j?.roomsCreated ?? 0),
          updated: j?.cohortsUpdated ?? 0,
          invited: j?.invited ?? 0,
          skipped: (j?.skipped ?? []).map((s) => ({
            row: s.row,
            code: s.detail ?? "",
            reason: s.reason,
          })),
        });
        setFullSummary({
          cohortsCreated: j?.cohortsCreated ?? 0,
          cohortsUpdated: j?.cohortsUpdated ?? 0,
          examClassesCreated: j?.examClassesCreated ?? 0,
          roomsCreated: j?.roomsCreated ?? 0,
        });
        setPasted("");
        setParsed(null);
        router.refresh();
        return;
      }

      // cohort_only mode
      const r = await fetch(`/api/courses/${courseId}/cohorts/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: parsed.rows.map((r) => ({
            code: r.code,
            instructorEmail: r.instructorEmail || null,
            name: r.name || null,
          })),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setResult({
          created: 0,
          updated: 0,
          invited: 0,
          skipped: [{ row: 0, code: "—", reason: j?.error ?? `HTTP ${r.status}` }],
        });
        return;
      }
      const j = (await r.json()) as typeof result;
      setResult(j);
      setFullSummary(null);
      setPasted("");
      setParsed(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="h-4 w-4 shrink-0 text-slate-400" /> Lớp học ({cohorts.length})
          </h2>
          <p className="mt-1 text-xs text-faint">
            Mỗi lớp gắn 1 GV phụ trách + mã lớp do trường định nghĩa. SV gõ mã
            lớp khi vào thi để route kết quả về đúng GV.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowImport((v) => !v)}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            {showImport ? "Đóng" : <><Upload className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Import / Paste hàng loạt</>}
          </button>
        )}
      </div>

      {showImport && canEdit && (
        <div className="rounded-lg border border-default bg-slate-50 p-4">
          <h3 className="text-sm font-semibold">Paste danh sách lớp</h3>
          <p className="mt-1 text-xs text-faint">
            Dòng đầu là <strong>tiêu đề cột</strong>. Hệ thống match theo tên
            cột (case-insensitive, không phụ thuộc thứ tự). Phân cách bằng dấu
            phẩy / chấm phẩy / tab. Dán từ Excel được.{" "}
            <span className="text-amber-800">
              ⓘ Email chưa có account sẽ được tự động gửi mời.
            </span>
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-700">
            Tiêu đề cột được nhận diện:
          </p>
          <ul className="mt-1 list-inside list-disc rounded border border-default bg-white px-3 py-2 text-[11px] text-slate-600">
            <li>
              <code>STT</code> — số thứ tự trong Excel (sort + đối chiếu)
            </li>
            <li>
              <code>Mã lớp học</code> (bắt buộc) — alias: mã lớp, cohort, code
            </li>
            <li>
              <code>Mã lớp thi</code> — alias: lớp thi, exam class
            </li>
            <li>
              <code>Số SV</code> — alias: sĩ số, số học sinh, student count
            </li>
            <li>
              <code>Kíp thi</code> — alias: ca thi, session, mã ca
            </li>
            <li>
              <code>Địa điểm</code> — alias: phòng, phòng thi, location
            </li>
            <li>
              <code>Giám thị</code> — alias: email giám thị, proctor, CBGS
            </li>
            <li>
              <code>Giáo viên</code> — alias: GV, email GV, teacher, CBGD
            </li>
            <li>
              <code>Tên lớp</code> — alias: tên cohort, name (optional)
            </li>
          </ul>
          <p className="mt-2 text-xs font-semibold text-slate-700">
            Ví dụ full (7 cột):
          </p>
          <pre className="mt-1 overflow-x-auto rounded border border-default bg-white px-3 py-2 text-xs text-slate-600">{`Mã lớp học, Mã lớp thi, Sĩ số, Kíp thi, Địa điểm, Giám thị, GV
K65A-T7C, K65A-T7C-P1, 50, CA-1, Nhà A1 P201, proc1@..., alice@...
K65A-T7C, K65A-T7C-P2, 48, CA-1, Nhà A1 P202, proc2@..., alice@...
K65B-T7S, K65B-T7S-P1, 50, CA-2, Nhà B2 P101, proc3@..., bob@...`}</pre>
          <p className="mt-1 text-[11px] text-faint">
            Kíp thi phải được tạo trước ở tab &quot;Ca thi&quot; (với giờ).
            Sheet này chỉ reference theo mã.
          </p>
          <textarea
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setParsed(null);
              setResult(null);
            }}
            rows={6}
            placeholder="K65A-T7C, alice@example.com, KNM K65A T7 Chiều"
            className="mt-3 w-full rounded border border-default bg-white px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={parsePaste}
              disabled={!pasted.trim()}
              className="rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Phân tích →
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5 shrink-0" /> Upload .xlsx / .csv
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const buf = await f.arrayBuffer();
                    const wb = XLSX.read(buf, { type: "array" });
                    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
                    // Convert to CSV string. xlsx auto-handles quoting/escaping.
                    const csv = XLSX.utils.sheet_to_csv(sheet, {
                      blankrows: false,
                    });
                    setPasted(csv);
                    setParsed(null);
                    setResult(null);
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {parsed && (
              <span className="text-xs text-faint">
                {parsed.rows.length} dòng OK · {parsed.errors.length} dòng lỗi
              </span>
            )}
          </div>

          {parsed && parsed.errors.length > 0 && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠ Bỏ qua {parsed.errors.length} dòng:
              <ul className="mt-1 list-inside list-disc">
                {parsed.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    Dòng {e.line}: {e.reason}
                  </li>
                ))}
                {parsed.errors.length > 5 && (
                  <li>...và {parsed.errors.length - 5} dòng khác</li>
                )}
              </ul>
            </div>
          )}

          {parsed && parsed.rows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded border border-default bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Mã lớp học</th>
                    {importMode === "full" && (
                      <>
                        <th className="px-2 py-1.5">Mã lớp thi</th>
                        <th className="px-2 py-1.5">SV</th>
                        <th className="px-2 py-1.5">Kíp</th>
                        <th className="px-2 py-1.5">Địa điểm</th>
                        <th className="px-2 py-1.5">Giám thị</th>
                      </>
                    )}
                    <th className="px-2 py-1.5">Email GV</th>
                    {importMode === "cohort_only" && (
                      <th className="px-2 py-1.5">Tên lớp</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 20).map((r) => (
                    <tr key={r.line} className="border-t border-default">
                      <td className="px-2 py-1 text-slate-500">{r.line}</td>
                      <td className="px-2 py-1 font-mono">{r.code}</td>
                      {importMode === "full" && (
                        <>
                          <td className="px-2 py-1 font-mono">
                            {r.examClassCode}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {r.studentCount ?? "—"}
                          </td>
                          <td className="px-2 py-1 font-mono">
                            {r.sessionCode}
                          </td>
                          <td className="px-2 py-1">{r.roomLocation || "—"}</td>
                          <td className="px-2 py-1">
                            {r.proctorEmail || (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1">
                        {r.instructorEmail || (
                          <span className="text-faint">(không gán GV)</span>
                        )}
                      </td>
                      {importMode === "cohort_only" && (
                        <td className="px-2 py-1">{r.name}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 20 && (
                <div className="border-t border-default bg-slate-50 px-2 py-1 text-xs text-faint">
                  ... và {parsed.rows.length - 20} dòng nữa
                </div>
              )}
              <div className="border-t border-default bg-slate-50 px-3 py-2 text-right">
                <button
                  onClick={submit}
                  disabled={busy}
                  className="rounded bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy ? "Đang xử lý..." : `Tạo / cập nhật ${parsed.rows.length} lớp`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {fullSummary ? (
                <>
                  ✓ Lớp học: {fullSummary.cohortsCreated} mới ·{" "}
                  {fullSummary.cohortsUpdated} cập nhật ·{" "}
                  Mã lớp thi: {fullSummary.examClassesCreated} mới ·{" "}
                  Phòng thi: {fullSummary.roomsCreated} mới
                </>
              ) : (
                <>
                  ✓ Tạo mới {result.created} · cập nhật {result.updated}
                </>
              )}
              {result.invited > 0 && (
                <> · <Mail className="inline h-3 w-3 align-text-bottom" /> mời {result.invited} người qua email</>
              )}
              {result.skipped.length > 0 && (
                <>
                  {" "}
                  · bỏ qua {result.skipped.length}:
                  <ul className="mt-1 list-inside list-disc text-emerald-800">
                    {result.skipped.slice(0, 5).map((s, i) => (
                      <li key={i}>
                        {s.code}: {humanizeReason(s.reason)}
                      </li>
                    ))}
                    {result.skipped.length > 5 && (
                      <li>...và {result.skipped.length - 5} dòng khác</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {cohorts.length === 0 && !addingManual && (
        <div className="rounded-lg border border-dashed border-default p-8 text-center text-sm text-faint">
          Chưa có lớp nào. Click &ldquo;+ Thêm lớp&rdquo; hoặc &ldquo;Import / Paste hàng loạt&rdquo; để bắt đầu.
        </div>
      )}
      {(cohorts.length > 0 || addingManual) && (
        <div className="overflow-x-auto rounded-lg border border-default bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortHeader
                  label="STT Excel"
                  field="stt"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                  align="right"
                />
                <SortHeader
                  label="Mã lớp thi"
                  field="examClass"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                />
                <SortHeader
                  label="Mã lớp học"
                  field="cohortCode"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                />
                <SortHeader
                  label="Địa điểm"
                  field="location"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                />
                <SortHeader
                  label="Ca thi"
                  field="session"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                />
                <SortHeader
                  label="Tên lớp"
                  field="cohortName"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                />
                <SortHeader
                  label="GV phụ trách"
                  field="instructor"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                />
                <SortHeader
                  label="Giám thị"
                  field="proctor"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={onHeaderClick}
                />
                {canEdit && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {cohorts
                .flatMap((c) => buildFlatRows(c))
                .sort((a, b) => sortRows(a, b, sortBy, sortDir))
                .map((row) => (
                  <FlatRow
                    key={row.key}
                    row={row}
                    sessions={sessions}
                    canEdit={canEdit}
                  />
                ))}
              {addingManual && (
                <AddCohortRow
                  courseId={courseId}
                  onDone={() => setAddingManual(false)}
                  onCancel={() => setAddingManual(false)}
                />
              )}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && !addingManual && (
        <div>
          <button
            onClick={() => setAddingManual(true)}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            + Thêm lớp
          </button>
        </div>
      )}
    </section>
  );
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDir,
  onClick,
  align,
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortDir: "asc" | "desc";
  onClick: (f: SortField) => void;
  align?: "left" | "right";
}) {
  const active = sortBy === field;
  const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "↕";
  return (
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onClick(field)}
        className={`inline-flex items-center gap-1 ${
          active ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {label}
        <span className={`text-[10px] ${active ? "" : "opacity-40"}`}>
          {arrow}
        </span>
      </button>
    </th>
  );
}

function sortRows(
  a: FlatRowData,
  b: FlatRowData,
  field: SortField,
  dir: "asc" | "desc",
): number {
  const sign = dir === "asc" ? 1 : -1;
  if (field === "stt") {
    const aN = a.room?.sourceRowNum ?? Number.POSITIVE_INFINITY;
    const bN = b.room?.sourceRowNum ?? Number.POSITIVE_INFINITY;
    if (aN !== bN) return sign * (aN - bN);
    return a.key.localeCompare(b.key);
  }
  const get = (r: FlatRowData): string => {
    switch (field) {
      case "examClass":
        return r.examClass?.code ?? "";
      case "cohortCode":
        return r.cohort.code ?? "";
      case "location":
        return r.room?.locationNote ?? r.examClass?.roomLocation ?? "";
      case "session":
        return r.room?.sessionCode ?? "";
      case "cohortName":
        return r.cohort.name;
      case "instructor":
        return r.cohort.instructorName ?? "";
      case "proctor":
        return r.room?.proctorName ?? "";
      default:
        return "";
    }
  };
  const aV = get(a);
  const bV = get(b);
  // Empty values sort cuối luôn.
  if (!aV && bV) return 1;
  if (aV && !bV) return -1;
  if (!aV && !bV) return a.key.localeCompare(b.key);
  return sign * aV.localeCompare(bV, "vi");
}

interface FlatRowData {
  key: string;
  cohort: CohortData;
  examClass: ExamClass | null;
  room: ExamClassRoom | null;
}

function buildFlatRows(cohort: CohortData): FlatRowData[] {
  if (cohort.examClasses.length === 0) {
    return [
      {
        key: cohort.id,
        cohort,
        examClass: null,
        room: null,
      },
    ];
  }
  const out: FlatRowData[] = [];
  for (const ec of cohort.examClasses) {
    if (ec.rooms.length === 0) {
      out.push({
        key: `${cohort.id}|${ec.id}`,
        cohort,
        examClass: ec,
        room: null,
      });
    } else {
      for (const room of ec.rooms) {
        out.push({
          key: `${cohort.id}|${ec.id}|${room.roomId}`,
          cohort,
          examClass: ec,
          room,
        });
      }
    }
  }
  return out;
}

function FlatRow({
  row,
  sessions,
  canEdit,
}: {
  row: FlatRowData;
  sessions: SessionOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { cohort, examClass, room } = row;
  const location = room?.locationNote ?? examClass?.roomLocation ?? null;
  const expected = examClass?.expectedStudentCount ?? null;
  const actual = examClass?.actualCandidateCount ?? 0;
  const mismatch = expected != null && expected !== actual;

  const [editing, setEditing] = useState(false);
  const [editLoc, setEditLoc] = useState(location ?? "");
  const [editProctor, setEditProctor] = useState("");
  const [editSession, setEditSession] = useState(room?.sessionId ?? "");
  const [editStt, setEditStt] = useState(room?.sourceRowNum?.toString() ?? "");
  const [editCohortName, setEditCohortName] = useState(cohort.name);
  const [editInstructorEmail, setEditInstructorEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startEdit = () => {
    setEditLoc(location ?? "");
    setEditProctor("");
    setEditSession(room?.sessionId ?? "");
    setEditStt(room?.sourceRowNum?.toString() ?? "");
    setEditCohortName(cohort.name);
    setEditInstructorEmail("");
    setErr(null);
    setEditing(true);
  };

  const save = async () => {
    if (!room) return;
    setBusy(true);
    setErr(null);
    try {
      // 1. ExamRoom fields
      const roomBody: Record<string, unknown> = {};
      if (editLoc !== (location ?? "")) roomBody.locationNote = editLoc || null;
      if (editProctor.trim()) roomBody.proctorEmail = editProctor.trim();
      if (editSession && editSession !== room.sessionId)
        roomBody.sessionId = editSession;
      const newStt = editStt.trim() === "" ? null : Number(editStt);
      if (newStt !== room.sourceRowNum)
        roomBody.sourceRowNum = newStt;
      if (Object.keys(roomBody).length > 0) {
        const r = await fetch(`/api/exam-rooms/${room.roomId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(roomBody),
        });
        if (!r.ok) {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          setErr(j?.error ?? `HTTP ${r.status}`);
          return;
        }
      }

      // 2. Cohort fields (name + instructor)
      const cohortBody: Record<string, unknown> = {};
      if (editCohortName.trim() && editCohortName !== cohort.name)
        cohortBody.name = editCohortName.trim();
      if (editInstructorEmail.trim())
        cohortBody.instructorEmail = editInstructorEmail.trim();
      if (Object.keys(cohortBody).length > 0) {
        const r = await fetch(`/api/cohorts/${cohort.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cohortBody),
        });
        if (!r.ok) {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          setErr(j?.error ?? `HTTP ${r.status}`);
          return;
        }
      }

      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!room) return;
    if (
      !window.confirm(
        `Xoá phòng thi "${examClass?.code ?? room.roomId}"? Không thể hoàn tác.`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-rooms/${room.roomId}`, {
        method: "DELETE",
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

  return (
    <tr className={`border-t border-default ${editing ? "bg-blue-50" : ""}`}>
      <td className="px-3 py-2 text-right font-mono text-xs text-faint">
        {editing && room ? (
          <input
            type="number"
            value={editStt}
            onChange={(e) => setEditStt(e.target.value)}
            min={0}
            className="w-16 rounded border border-default px-2 py-1 text-right text-xs"
          />
        ) : (
          room?.sourceRowNum ?? <span>—</span>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {examClass?.code ?? <span className="text-faint">—</span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {cohort.code ?? <span className="text-amber-700">⚠</span>}
      </td>
      <td className="px-3 py-2 text-xs">
        {editing && room ? (
          <input
            value={editLoc}
            onChange={(e) => setEditLoc(e.target.value)}
            placeholder="Phòng A101"
            className="w-32 rounded border border-default px-2 py-1 text-xs"
          />
        ) : location ? (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-slate-400" />{location}</span>
        ) : (
          <span className="text-faint">—</span>
        )}
        {!editing && (expected != null || actual > 0) && (
          <div
            className={`mt-0.5 text-[11px] ${mismatch ? "font-medium text-amber-700" : "text-faint"}`}
            title={
              mismatch
                ? `Khai ${expected} SV nhưng có ${actual} đã đăng ký`
                : undefined
            }
          >
            <Users className="inline h-3 w-3 align-text-bottom text-slate-400" /> {actual}
            {expected != null ? ` / ${expected}` : ""}
            {mismatch && " ⚠"}
          </div>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {editing && room ? (
          <select
            value={editSession}
            onChange={(e) => setEditSession(e.target.value)}
            className="rounded border border-default bg-white px-2 py-1 text-xs"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ?? "(no code)"}
                {s.title ? ` — ${s.title}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <>
            {room?.sessionCode ?? <span className="text-faint">—</span>}
            {room?.sessionTitle && (
              <div className="text-[11px] text-faint">{room.sessionTitle}</div>
            )}
          </>
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {editing ? (
          <input
            value={editCohortName}
            onChange={(e) => setEditCohortName(e.target.value)}
            maxLength={200}
            className="w-40 rounded border border-default px-2 py-1 text-sm"
          />
        ) : (
          cohort.name
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {editing ? (
          <input
            type="email"
            value={editInstructorEmail}
            onChange={(e) => setEditInstructorEmail(e.target.value)}
            placeholder={cohort.instructorName ?? "email GV"}
            className="w-36 rounded border border-default px-2 py-1 text-xs"
          />
        ) : cohort.instructorName ? (
          cohort.instructorName
        ) : (
          <span className="text-amber-700">⚠ chưa gán</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {editing && room ? (
          <input
            type="email"
            value={editProctor}
            onChange={(e) => setEditProctor(e.target.value)}
            placeholder={room.proctorName || "email giám thị"}
            className="w-36 rounded border border-default px-2 py-1 text-xs"
          />
        ) : room ? (
          room.proctorName
        ) : (
          <span className="text-faint">—</span>
        )}
        {editing && err && (
          <div className="mt-1 text-[11px] text-red-700">⚠ {err}</div>
        )}
      </td>
      {canEdit && (
        <td className="px-3 py-2 text-right whitespace-nowrap">
          {room ? (
            editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setErr(null);
                  }}
                  disabled={busy}
                  className="mr-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  Huỷ
                </button>
                <button
                  onClick={save}
                  disabled={busy}
                  className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy ? "..." : "Lưu"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEdit}
                  className="mr-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
                  title="Sửa tất cả field"
                >
                  ✎
                </button>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="rounded border border-default bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Xoá phòng thi"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )
          ) : (
            <span className="text-[11px] text-faint">—</span>
          )}
        </td>
      )}
    </tr>
  );
}

function CohortRow({
  cohort,
  canEdit,
}: {
  cohort: CohortData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editingGv, setEditingGv] = useState(false);
  const [name, setName] = useState(cohort.name);
  const [code, setCode] = useState(cohort.code ?? "");
  const [gvEmail, setGvEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cohorts/${cohort.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => null)) as
        | { error?: string; invited?: boolean }
        | null;
      if (!r.ok) {
        setErr(j?.error ?? `HTTP ${r.status}`);
        return false;
      }
      if (j?.invited) {
        setFlash("Đã gửi email mời GV");
        setTimeout(() => setFlash(null), 3000);
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    const ok = await patch({
      name: name.trim(),
      code: code.trim() ? code.trim() : null,
    });
    if (ok) setEditing(false);
  };

  const onSaveGv = async () => {
    const email = gvEmail.trim();
    const ok = await patch({ instructorEmail: email });
    if (ok) {
      setEditingGv(false);
      setGvEmail("");
    }
  };

  const onClearGv = async () => {
    if (!window.confirm("Gỡ GV phụ trách khỏi lớp này?")) return;
    await patch({ instructorEmail: "" });
  };

  const onDelete = async () => {
    if (
      !window.confirm(
        `Xoá lớp "${cohort.name}"? Không thể hoàn tác. Lớp đang có ca thi sẽ bị reject.`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cohorts/${cohort.id}`, {
        method: "DELETE",
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

  if (editing) {
    return (
      <tr className="border-t border-default bg-blue-50">
        <td className="px-3 py-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={16}
            placeholder="K65A-T7C"
            className="w-32 rounded border border-default px-2 py-1 font-mono text-xs uppercase"
          />
        </td>
        <td className="px-3 py-2 text-xs text-faint">— (sửa riêng)</td>
        <td className="px-3 py-2 text-xs text-faint">—</td>
        <td className="px-3 py-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="w-full rounded border border-default px-2 py-1 text-sm"
          />
        </td>
        <td className="px-3 py-2 text-xs text-faint">
          {err && <span className="text-red-700">⚠ {err}</span>}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            onClick={() => {
              setEditing(false);
              setName(cohort.name);
              setCode(cohort.code ?? "");
              setErr(null);
            }}
            disabled={busy}
            className="mr-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={onSave}
            disabled={busy || !name.trim()}
            className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "..." : "Lưu"}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-default">
      <td className="px-3 py-2 font-mono text-xs">
        {cohort.code ?? <span className="text-amber-700">⚠ chưa có mã</span>}
      </td>
      <td className="px-3 py-2 text-xs">
        <ExamClassCodesCell cohort={cohort} canEdit={canEdit} />
      </td>
      <td className="px-3 py-2 text-xs">
        <ExamClassLocationsCell cohort={cohort} />
      </td>
      <td className="px-3 py-2 font-medium">{cohort.name}</td>
      <td className="px-3 py-2 text-xs">
        {editingGv ? (
          <div className="flex items-center gap-1">
            <input
              type="email"
              value={gvEmail}
              onChange={(e) => setGvEmail(e.target.value)}
              placeholder="gv@school.edu.vn"
              className="w-48 rounded border border-default px-2 py-1 text-xs"
              autoFocus
            />
            <button
              onClick={onSaveGv}
              disabled={busy || !gvEmail.trim()}
              className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "..." : "OK"}
            </button>
            <button
              onClick={() => {
                setEditingGv(false);
                setGvEmail("");
                setErr(null);
              }}
              className="text-xs text-slate-500 hover:underline"
            >
              Huỷ
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {cohort.instructorName ? (
              <span>{cohort.instructorName}</span>
            ) : (
              <span className="text-amber-700">⚠ chưa gán</span>
            )}
            {canEdit && (
              <button
                onClick={() => setEditingGv(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Đổi
              </button>
            )}
            {canEdit && cohort.instructorId && (
              <button
                onClick={onClearGv}
                disabled={busy}
                className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
                title="Gỡ GV phụ trách"
              >
                ✕
              </button>
            )}
          </div>
        )}
        {flash && (
          <div className="mt-1 text-xs text-emerald-700">{flash}</div>
        )}
        {err && !editing && !editingGv && (
          <div className="mt-1 text-xs text-red-700">⚠ {err}</div>
        )}
      </td>
      {canEdit && (
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <button
            onClick={() => setEditing(true)}
            className="mr-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
            title="Sửa mã & tên"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded border border-default bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            title="Xoá lớp"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

function ExamClassLocationsCell({ cohort }: { cohort: CohortData }) {
  if (cohort.examClasses.length === 0) {
    return <span className="text-faint">—</span>;
  }
  return (
    <div className="space-y-1">
      {cohort.examClasses.map((ec) => {
        const expected = ec.expectedStudentCount;
        const actual = ec.actualCandidateCount;
        const hasExpected = expected != null;
        const mismatch = hasExpected && expected !== actual;
        return (
          <div key={ec.id} className="text-[11px] text-slate-700">
            <div>
              {ec.roomLocation ? (
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-slate-400" />{ec.roomLocation}</span>
              ) : (
                <span className="text-faint">—</span>
              )}
            </div>
            {(hasExpected || actual > 0) && (
              <div
                className={
                  mismatch ? "font-medium text-amber-700" : "text-faint"
                }
                title={
                  mismatch
                    ? `Khai ${expected} SV nhưng có ${actual} đã đăng ký`
                    : undefined
                }
              >
                <Users className="inline h-3 w-3 align-text-bottom text-slate-400" /> {actual}
                {hasExpected ? ` / ${expected}` : ""}
                {mismatch && " ⚠"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExamClassCodesCell({
  cohort,
  canEdit,
}: {
  cohort: CohortData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!newCode.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cohorts/${cohort.id}/exam-classes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          roomLocation: newLocation.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error === "validation_failed" ? "trùng mã hoặc rỗng" : j?.error ?? `HTTP ${r.status}`);
        return;
      }
      setNewCode("");
      setNewLocation("");
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, code: string) => {
    if (!window.confirm(`Gỡ mã lớp thi "${code}"?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/cohort-exam-classes/${id}`, {
        method: "DELETE",
      });
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      {cohort.examClasses.length === 0 && !adding && (
        <span className="text-faint">—</span>
      )}
      {cohort.examClasses.map((ec) => (
        <div key={ec.id} className="flex items-center gap-1.5">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
            {ec.code}
          </span>
          {canEdit && (
            <button
              onClick={() => remove(ec.id, ec.code)}
              disabled={busy}
              className="text-[10px] text-slate-400 hover:text-red-600"
              title="Gỡ"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {adding ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="K65A-T7C-P1"
            maxLength={32}
            autoFocus
            className="w-32 rounded border border-default px-1.5 py-0.5 font-mono text-[11px] uppercase"
          />
          <input
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Nhà A1, P201"
            maxLength={200}
            className="w-32 rounded border border-default px-1.5 py-0.5 text-[11px]"
          />
          <button
            onClick={submit}
            disabled={busy || !newCode.trim()}
            className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "..." : "OK"}
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setNewCode("");
              setNewLocation("");
              setErr(null);
            }}
            className="text-[11px] text-slate-500 hover:underline"
          >
            Huỷ
          </button>
          {err && <div className="w-full text-[11px] text-red-700">⚠ {err}</div>}
        </div>
      ) : (
        canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] text-blue-600 hover:underline"
          >
            + Thêm mã
          </button>
        )
      )}
    </div>
  );
}

function AddCohortRow({
  courseId,
  onDone,
  onCancel,
}: {
  courseId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/courses/${courseId}/cohorts/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: [
            {
              code: code.trim().toUpperCase(),
              instructorEmail: email.trim() || null,
              name: name.trim() || null,
            },
          ],
        }),
      });
      const j = (await r.json().catch(() => null)) as {
        error?: string;
        created?: number;
        updated?: number;
        invited?: number;
        skipped?: Array<{ reason: string }>;
      } | null;
      if (!r.ok || (j?.skipped && j.skipped.length > 0)) {
        const reason =
          j?.skipped?.[0]?.reason ?? j?.error ?? `HTTP ${r.status}`;
        setErr(humanizeReason(reason));
        return;
      }
      router.refresh();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-default bg-emerald-50">
      <td className="px-3 py-2 text-right text-xs text-faint">—</td>
      <td className="px-3 py-2 text-xs text-faint">— (thêm sau)</td>
      <td className="px-3 py-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={16}
          placeholder="K65A-T7C"
          autoFocus
          className="w-32 rounded border border-default px-2 py-1 font-mono text-xs uppercase"
        />
      </td>
      <td className="px-3 py-2 text-xs text-faint">—</td>
      <td className="px-3 py-2 text-xs text-faint">—</td>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="Tên lớp (tùy chọn)"
          className="w-full rounded border border-default px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email_GV@... (tùy chọn)"
          className="w-full rounded border border-default px-2 py-1 text-xs"
        />
        {err && (
          <div className="mt-1 text-xs text-red-700">⚠ {err}</div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-faint">—</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          onClick={onCancel}
          disabled={busy}
          className="mr-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
        >
          Huỷ
        </button>
        <button
          onClick={submit}
          disabled={busy || !code.trim()}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "..." : "Tạo lớp"}
        </button>
      </td>
    </tr>
  );
}

// PR2.16 — Header alias → canonical field. Case-insensitive, accent-insensitive.
function mapHeader(h: string): keyof ParsedRow | "_skip" {
  const norm = h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
  // STT (PR2.18) — số thứ tự trong Excel
  if (/^(stt|stt\w*|sothutu|sttexcel|sttexcell)$/.test(norm)) return "stt";
  // cohort code
  if (
    /^(macohort|malophoc|maclass|cohortcode|cohort|maclass|malop)$/.test(norm) ||
    norm === "code"
  )
    return "code";
  // cohort name
  if (/^(tenlop|tencohort|cohortname|name)$/.test(norm)) return "name";
  // exam class
  if (
    /^(malopthi|lopthi|maphongthi|examclass|examclasscode|maphong|maca)$/.test(
      norm,
    )
  )
    return "examClassCode";
  // student count
  if (
    /^(sohocsinh|sosv|sisi|siso|sluongsv|studentcount|sostudent|sosinhvien)$/.test(
      norm,
    )
  )
    return "studentCount";
  // session
  if (
    /^(kipthi|cathi|macathi|makipthi|session|sessioncode)$/.test(norm)
  )
    return "sessionCode";
  // location
  if (/^(diadiem|phong|phongthi|location|room)$/.test(norm))
    return "roomLocation";
  // proctor
  if (
    /^(giamthi|emailgiamthi|proctor|emailproctor|cbgs|cbsgs)$/.test(norm)
  )
    return "proctorEmail";
  // instructor
  if (
    /^(giaovien|gv|emailgv|teacher|instructor|emailgiaovien|cb|cbgd|cbgiangday)$/.test(
      norm,
    )
  )
    return "instructorEmail";
  return "_skip";
}

function humanizeReason(reason: string): string {
  const map: Record<string, string> = {
    invalid_email: "email không hợp lệ",
    invite_failed: "không gửi được email mời GV",
    code_required: "thiếu mã lớp",
    name_taken: "tên lớp đã tồn tại",
    error: "lỗi không xác định",
  };
  return map[reason] ?? reason;
}
