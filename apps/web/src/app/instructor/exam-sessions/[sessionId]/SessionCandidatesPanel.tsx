"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardPaste, Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { PERSON_HEADERS, parsePastedTable } from "@/lib/pasteTable";
import StickyMobileCTA from "@/components/ui/StickyMobileCTA";

/**
 * Bước 1 của luồng "Thí sinh và phòng": danh sách thí sinh của CẢ CA, chưa cần
 * phòng. Ba nguồn: dán từ Excel, gõ từng em, lấy từ lớp học (+ dán cột MSSV ghép
 * theo email). Mọi kiểm tra chạy ở máy chủ (core-lms/exam/session-candidates.ts);
 * ở đây chỉ đọc bảng dán và hiển thị kết quả.
 */

type CodeSource = "random" | "student_code";

interface CandidateRow {
  id: string;
  displayName: string;
  mssv: string | null;
  email: string | null;
  accessCode: string | null;
  needsMssv: boolean;
  roomName: string | null;
  linkedAccount: boolean;
  hasAttempt: boolean;
}

interface CandidateList {
  accessMode: string;
  codeSource: CodeSource;
  hasCourse: boolean;
  rows: CandidateRow[];
}

interface CheckedRow {
  line: number;
  displayName?: string;
  candidateName?: string;
  mssv: string | null;
  email: string | null;
  message?: string;
}

interface CheckResult {
  rows: CheckedRow[];
  valid?: number;
  matched?: number;
  invalid: number;
  saved: boolean;
}

type Panel = "paste" | "manual" | "class" | "attach" | null;

// ---------------------------------------------------------------------------

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const j = (await r.json().catch(() => null)) as
    | (T & { error?: string; details?: { reason?: string; message?: string; name?: string } })
    | null;
  if (!r.ok) throw new Error(errorText(j?.error, j?.details));
  return j as T;
}

function errorText(code?: string, d?: { reason?: string; message?: string; name?: string }): string {
  if (d?.message) return d.message;
  if (d?.reason === "mssv_used") return `MSSV này đã thuộc về ${d.name}.`;
  if (d?.reason === "student_code_required") return "Mã thi là MSSV nên không được để trống MSSV.";
  if (d?.reason === "email_invalid") return "Email không đúng định dạng.";
  if (code === "forbidden") return "Thầy/cô không có quyền sửa ca thi này.";
  if (code === "candidate_has_attempts") return "Thí sinh đã vào thi nên không xoá hay đổi mã thi được.";
  if (code === "candidate_code_collision") return "MSSV này đang là mã thi của một thí sinh khác cùng đề thi.";
  if (code === "candidate_name_required") return "Cần nhập họ tên.";
  if (code === "unauthorized") return "Phiên đăng nhập đã hết. Thầy/cô tải lại trang để đăng nhập.";
  return `Không lưu được (mã lỗi: ${code ?? "không rõ"}).`;
}

const givenName = (n: string) => n.trim().split(/\s+/).pop() ?? n;
const byVietnameseName = (a: { displayName: string }, b: { displayName: string }) =>
  givenName(a.displayName).localeCompare(givenName(b.displayName), "vi") ||
  a.displayName.localeCompare(b.displayName, "vi");

// ---------------------------------------------------------------------------

export default function SessionCandidatesPanel({
  sessionId,
  accessMode,
  canEdit,
}: {
  sessionId: string;
  /** Chế độ của ca theo trang chủ; đổi ở thẻ "Chế độ thi" thì tải lại danh sách. */
  accessMode: string;
  canEdit: boolean;
}) {
  const base = `/api/exam-sessions/${sessionId}/candidates`;
  const [list, setList] = useState<CandidateList | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setList(await call<CandidateList>(base));
      setLoadErr(null);
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, [base]);
  useEffect(() => {
    void reload();
  }, [reload, accessMode]);

  const done = async (msg: string, next: Panel = null) => {
    setNotice(msg);
    setPanel(next);
    await reload();
  };

  if (loadErr) return <div className="banner-danger">{loadErr}</div>;
  if (!list) return <div className="h-24 animate-pulse rounded-lg bg-slate-100" aria-label="Đang tải danh sách thí sinh" />;

  const mssvIsCode = list.codeSource === "student_code";
  const needsMssv = list.rows.filter((r) => r.needsMssv).length;

  return (
    <section className="rounded-lg border border-default bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h4">
          Danh sách thí sinh{list.rows.length > 0 && <span className="text-faint"> ({list.rows.length})</span>}
        </h2>
      </div>

      {list.accessMode !== "assigned_code" ? (
        <p className="mt-2 text-sm text-faint">
          {list.accessMode === "open_code"
            ? "Ca thi đang ở chế độ Tự do: thí sinh tự nhập tên khi vào thi, nên không cần danh sách trước."
            : "Thầy/cô chọn chế độ thi ở phía trên trước. Danh sách thí sinh chỉ dùng cho chế độ Theo phòng."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-faint">
            Thêm toàn bộ thí sinh của ca thi trước, chưa cần nghĩ tới phòng.{" "}
            {mssvIsCode ? "Mã thi của mỗi em là MSSV." : "Mỗi em được cấp một mã thi ngẫu nhiên 8 ký tự."}
          </p>

          {notice && (
            <div className="banner-success mt-3 flex items-start justify-between gap-3">
              <span>{notice}</span>
              <button className="text-xs underline" onClick={() => setNotice(null)}>
                Ẩn
              </button>
            </div>
          )}

          {needsMssv > 0 && panel !== "attach" && (
            <div className="banner-warning mt-3 flex flex-wrap items-center justify-between gap-2">
              <span>
                {needsMssv} thí sinh chưa có mã thi vì chưa có MSSV. Các em này chưa vào thi được.
              </span>
              {canEdit && (
                <button className="btn btn-secondary btn-sm" onClick={() => setPanel("attach")}>
                  Dán cột MSSV
                </button>
              )}
            </div>
          )}

          {canEdit && panel === null && list.rows.length === 0 && (
            <SourceOptions hasCourse={list.hasCourse} onPick={setPanel} />
          )}

          {panel === "paste" && (
            <PastePanel
              base={base}
              mssvIsCode={mssvIsCode}
              onCancel={() => setPanel(null)}
              onSaved={(n, skipped) =>
                done(
                  `Đã thêm ${n} thí sinh${skipped ? `, bỏ qua ${skipped} dòng lỗi` : ""}. Mỗi em đã có mã thi riêng.`,
                )
              }
            />
          )}
          {panel === "manual" && (
            <ManualPanel
              base={base}
              mssvIsCode={mssvIsCode}
              onCancel={() => setPanel(null)}
              onSaved={(name) => done(`Đã thêm ${name}.`, "manual")}
            />
          )}
          {panel === "class" && (
            <ClassPanel
              base={base}
              onCancel={() => setPanel(null)}
              onSaved={(n) =>
                mssvIsCode
                  ? done(
                      `Đã thêm ${n} học viên. Vì mã thi là MSSV, thầy/cô dán thêm cột MSSV để các em có mã thi.`,
                      "attach",
                    )
                  : done(`Đã thêm ${n} học viên. Mỗi em đã có mã thi riêng.`)
              }
            />
          )}
          {panel === "attach" && (
            <AttachPanel
              base={base}
              onCancel={() => setPanel(null)}
              onSaved={(n) => done(`Đã ghép MSSV cho ${n} thí sinh.`)}
            />
          )}

          {list.rows.length > 0 && (
            <CandidateTable
              base={base}
              rows={list.rows}
              canEdit={canEdit}
              hasCourse={list.hasCourse}
              onPick={(p) => {
                setNotice(null);
                setPanel(p);
              }}
              onChanged={reload}
            />
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function SourceOptions({ hasCourse, onPick }: { hasCourse: boolean; onPick: (p: Panel) => void }) {
  const opts: Array<{ key: Panel; icon: React.ReactNode; title: string; desc: string }> = [
    ...(hasCourse
      ? [
          {
            key: "class" as const,
            icon: <Users className="h-5 w-5" />,
            title: "Lấy từ lớp học",
            desc: "Chọn lớp của khoá học. Hệ thống đưa các em đã ghi danh vào danh sách, không phải gõ lại.",
          },
        ]
      : []),
    {
      key: "paste",
      icon: <ClipboardPaste className="h-5 w-5" />,
      title: "Dán từ Excel",
      desc: "Bôi đen bảng trong Excel hoặc Google Sheets, sao chép rồi dán vào đây. Hệ thống tự nhận cột.",
    },
    {
      key: "manual",
      icon: <UserPlus className="h-5 w-5" />,
      title: "Gõ từng em",
      desc: "Phù hợp khi chỉ có vài thí sinh, hoặc cần bổ sung một em thi muộn.",
    },
  ];
  return (
    <div className={`mt-4 grid gap-3 ${hasCourse ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onPick(o.key)}
          className="rounded-lg border border-default bg-white p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
        >
          <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-100 text-brand-800">
            {o.icon}
          </span>
          <div className="font-semibold">{o.title}</div>
          <div className="mt-0.5 text-sm text-faint">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Bảng xem trước: dòng lỗi lên đầu, tô đỏ kèm lý do; dòng hợp lệ chỉ hiện vài dòng đầu. */
function PreviewTable({ rows, columns }: { rows: CheckedRow[]; columns: "person" | "attach" }) {
  const bad = rows.filter((r) => r.message);
  const good = rows.filter((r) => !r.message);
  const shown = [...bad, ...good.slice(0, 5)];
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-default">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">Dòng</th>
            {columns === "person" ? (
              <>
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">MSSV</th>
                <th className="px-3 py-2">Email</th>
              </>
            ) : (
              <>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">MSSV</th>
                <th className="px-3 py-2">Thí sinh</th>
              </>
            )}
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.line} className={`border-t border-default ${r.message ? "bg-red-50" : ""}`}>
              <td className="px-3 py-2 text-faint">{r.line}</td>
              {columns === "person" ? (
                <>
                  <td className="px-3 py-2">{r.displayName || "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.mssv || "—"}</td>
                  <td className="px-3 py-2 text-faint">{r.email ?? ""}</td>
                </>
              ) : (
                <>
                  <td className="px-3 py-2">{r.email || "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.mssv || "—"}</td>
                  <td className="px-3 py-2">{r.candidateName ?? ""}</td>
                </>
              )}
              <td className="whitespace-nowrap px-3 py-2">
                {r.message ? (
                  <span className="font-semibold text-red-700">{r.message}</span>
                ) : (
                  <span className="text-faint">Hợp lệ</span>
                )}
              </td>
            </tr>
          ))}
          {good.length > 5 && (
            <tr className="border-t border-default">
              <td colSpan={5} className="px-3 py-2 text-faint">
                … và {good.length - 5} dòng hợp lệ khác
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Khung chung cho "dán bảng → kiểm tra → lưu": dùng cho danh sách thí sinh và cho
 * cột MSSV. Bảng dán sửa lại thì kết quả kiểm tra cũ bị bỏ, tránh lưu nhầm.
 */
function PasteFlow({
  label,
  placeholder,
  sample,
  parse,
  endpoint,
  columns,
  saveLabel,
  onCancel,
  onSaved,
}: {
  label: React.ReactNode;
  placeholder: string;
  sample: string;
  parse: (raw: string) => { rows: Array<Record<string, unknown>>; error: string | null };
  endpoint: string;
  columns: "person" | "attach";
  saveLabel: (ok: number, bad: number) => string;
  onCancel: () => void;
  onSaved: (ok: number, bad: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parse(raw), [raw, parse]);
  const ok = check ? (check.valid ?? check.matched ?? 0) : 0;

  const run = async (dryRun: boolean) => {
    setErr(null);
    if (parsed.error) return setErr(parsed.error);
    setBusy(true);
    try {
      const r = await call<CheckResult>(endpoint, { method: "POST", body: { rows: parsed.rows, dryRun } });
      if (dryRun) setCheck(r);
      else onSaved(r.valid ?? r.matched ?? 0, r.invalid);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveButton = (label: string) => (
    <button className="btn btn-primary" disabled={busy || ok === 0} onClick={() => run(false)}>
      {busy ? "Đang lưu…" : label}
    </button>
  );

  return (
    <div className="mt-4 rounded-lg border border-default bg-slate-50 p-4">
      <label className="block text-sm text-slate-700" htmlFor="paste-box">
        {label}
      </label>
      <textarea
        id="paste-box"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setCheck(null);
        }}
        placeholder={placeholder}
        rows={6}
        className="input mt-2 w-full font-mono text-sm"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          className="text-sm text-brand-700 underline underline-offset-2"
          onClick={() => {
            setRaw(sample);
            setCheck(null);
          }}
        >
          Xem bảng mẫu
        </button>
        <span className="flex-1" />
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          Huỷ
        </button>
        <button className="btn btn-primary btn-sm" disabled={busy || !raw.trim()} onClick={() => run(true)}>
          {busy && !check ? "Đang kiểm tra…" : "Kiểm tra danh sách"}
        </button>
      </div>
      {err && <div className="banner-danger mt-3">{err}</div>}
      {check && (
        <>
          <div className={`mt-3 ${check.invalid ? "banner-warning" : "banner-success"}`}>
            {check.invalid
              ? `Nhận được ${check.rows.length} dòng: ${ok} dòng hợp lệ, ${check.invalid} dòng có lỗi được tô đỏ bên dưới.`
              : `Nhận được ${check.rows.length} dòng, tất cả đều hợp lệ.`}
          </div>
          <PreviewTable rows={check.rows} columns={columns} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {check.invalid > 0 && (
              <span className="text-sm text-faint">
                Dòng lỗi sẽ được bỏ qua. Thầy/cô sửa trong Excel rồi dán lại riêng các dòng đó sau.
              </span>
            )}
            <span className="flex-1" />
            <span className="hidden lg:inline-flex">{saveButton(saveLabel(ok, check.invalid))}</span>
          </div>
          <StickyMobileCTA
            primary={saveLabel(ok, 0)}
            secondary={check.invalid ? `Bỏ qua ${check.invalid} dòng lỗi` : undefined}
            action={saveButton("Lưu")}
          />
        </>
      )}
    </div>
  );
}

function PastePanel({
  base,
  mssvIsCode,
  onCancel,
  onSaved,
}: {
  base: string;
  mssvIsCode: boolean;
  onCancel: () => void;
  onSaved: (n: number, skipped: number) => void;
}) {
  const parse = useCallback((raw: string) => {
    const { rows, fields } = parsePastedTable(raw, PERSON_HEADERS);
    const error =
      raw.trim() && !fields.includes("displayName")
        ? 'Chưa nhận ra cột họ tên. Thầy/cô dán cả dòng tiêu đề, trong đó có một cột tên là "Họ tên" (các cột khác: MSSV, Email).'
        : raw.trim() && rows.length === 0
          ? "Bảng mới có dòng tiêu đề, chưa có thí sinh nào."
          : null;
    return { rows, error };
  }, []);
  return (
    <PasteFlow
      label={
        <>
          Dán bảng vào ô dưới. Dòng đầu là tên cột: <b>Họ tên</b>, <b>MSSV</b>, <b>Email</b>.{" "}
          {mssvIsCode ? "Cột MSSV bắt buộc vì mã thi là MSSV." : "Cột MSSV và Email không bắt buộc."}
        </>
      }
      placeholder={"Họ tên\tMSSV\tEmail\nNguyễn Văn An\t20261001\tan@sv.edu.vn"}
      sample={
        "Họ tên\tMSSV\tEmail\nNguyễn Văn An\t20261001\tan@sv.edu.vn\nTrần Thị Bình\t20261002\tbinh@sv.edu.vn\nLê Minh Chi\t20261003\t"
      }
      parse={parse}
      endpoint={base}
      columns="person"
      saveLabel={(ok, bad) => `Thêm ${ok} thí sinh${bad ? `, bỏ qua ${bad} dòng lỗi` : ""}`}
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}

function AttachPanel({
  base,
  onCancel,
  onSaved,
}: {
  base: string;
  onCancel: () => void;
  onSaved: (n: number) => void;
}) {
  const parse = useCallback((raw: string) => {
    const { rows, fields } = parsePastedTable(raw, { email: PERSON_HEADERS.email, mssv: PERSON_HEADERS.mssv });
    const error =
      raw.trim() && (!fields.includes("email") || !fields.includes("mssv"))
        ? 'Cần dòng tiêu đề có hai cột "Email" và "MSSV".'
        : null;
    return { rows, error };
  }, []);
  return (
    <PasteFlow
      label={
        <>
          Tài khoản học viên chưa có MSSV. Thầy/cô dán bảng hai cột <b>Email</b> và <b>MSSV</b>, hệ thống ghép
          theo email với thí sinh trong ca. Cột Họ tên nếu có sẽ được bỏ qua.
        </>
      }
      placeholder={"Email\tMSSV\nan@sv.edu.vn\t20261001"}
      sample={"Email\tMSSV\nan@sv.edu.vn\t20261001\nbinh@sv.edu.vn\t20261002"}
      parse={parse}
      endpoint={`${base}/attach-mssv`}
      columns="attach"
      saveLabel={(ok, bad) => `Ghép MSSV cho ${ok} thí sinh${bad ? `, bỏ qua ${bad} dòng lỗi` : ""}`}
      onCancel={onCancel}
      onSaved={(n) => onSaved(n)}
    />
  );
}

// ---------------------------------------------------------------------------

function ManualPanel({
  base,
  mssvIsCode,
  onCancel,
  onSaved,
}: {
  base: string;
  mssvIsCode: boolean;
  onCancel: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [mssv, setMssv] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await call<CheckResult>(base, {
        method: "POST",
        body: { rows: [{ line: 1, displayName: name, mssv, email }] },
      });
      const issue = r.rows[0]?.message;
      if (issue) return setErr(issue);
      onSaved(name.trim());
      setName("");
      setMssv("");
      setEmail("");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-lg border border-default bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-700">
          Họ tên
          <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn An" autoFocus />
        </label>
        <label className="text-sm text-slate-700">
          MSSV{mssvIsCode ? "" : " (không bắt buộc)"}
          <input className="input mt-1 w-full" value={mssv} onChange={(e) => setMssv(e.target.value)} placeholder="20261001" />
        </label>
        <label className="text-sm text-slate-700">
          Email (không bắt buộc)
          <input className="input mt-1 w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="an@sv.edu.vn" />
        </label>
      </div>
      {err && <p className="mt-2 text-sm font-semibold text-red-700">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          Xong
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>
          {busy ? "Đang thêm…" : "Thêm thí sinh"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

interface SectionOption {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
  studentCount: number;
}
interface StudentOption {
  userId: string;
  displayName: string;
  email: string;
  alreadyInSession: boolean;
}

function ClassPanel({
  base,
  onCancel,
  onSaved,
}: {
  base: string;
  onCancel: () => void;
  onSaved: (n: number) => void;
}) {
  const [sections, setSections] = useState<SectionOption[] | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [students, setStudents] = useState<StudentOption[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call<SectionOption[]>(`${base}/sections`)
      .then((s) => {
        setSections(s);
        if (s.length === 1) setSectionId(s[0]!.id);
      })
      .catch((e) => setErr((e as Error).message));
  }, [base]);

  useEffect(() => {
    if (!sectionId) return setStudents(null);
    setStudents(null);
    call<StudentOption[]>(`${base}/sections/${sectionId}`)
      .then((list) => {
        setStudents(list);
        setPicked(new Set(list.filter((s) => !s.alreadyInSession).map((s) => s.userId)));
      })
      .catch((e) => setErr((e as Error).message));
  }, [base, sectionId]);

  const selectable = students?.filter((s) => !s.alreadyInSession) ?? [];
  const allPicked = selectable.length > 0 && selectable.every((s) => picked.has(s.userId));

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await call<{ added: number }>(`${base}/sections/${sectionId}`, {
        method: "POST",
        body: { userIds: [...picked] },
      });
      onSaved(r.added);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = (label: string) => (
    <button className="btn btn-primary" disabled={busy || picked.size === 0} onClick={submit}>
      {busy ? "Đang thêm…" : label}
    </button>
  );

  return (
    <div className="mt-4 rounded-lg border border-default bg-slate-50 p-4">
      {sections === null ? (
        <p className="text-sm text-faint">Đang tải danh sách lớp…</p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-faint">Khoá học này chưa có học viên nào ghi danh.</p>
      ) : (
        <label className="block text-sm text-slate-700">
          Chọn lớp
          <select className="input mt-1 w-full sm:w-auto" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">— Chọn lớp —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.isDefault ? "Học viên chưa xếp lớp" : s.name}
                {s.code && !s.isDefault ? ` (${s.code})` : ""} · {s.studentCount} học viên
              </option>
            ))}
          </select>
        </label>
      )}

      {sectionId && students === null && <p className="mt-3 text-sm text-faint">Đang tải học viên…</p>}
      {students && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(selectable.map((s) => s.userId)))}
              />
              Chọn tất cả ({selectable.length})
            </label>
            {students.length > selectable.length && (
              <span className="text-faint">{students.length - selectable.length} em đã có trong ca được làm mờ.</span>
            )}
          </div>
          <ul className="mt-2 max-h-72 divide-y divide-[rgb(var(--border))] overflow-y-auto rounded-lg border border-default bg-white">
            {students.map((s) => (
              <li key={s.userId} className={s.alreadyInSession ? "opacity-50" : ""}>
                <label className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={s.alreadyInSession}
                    checked={s.alreadyInSession || picked.has(s.userId)}
                    onChange={() =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (n.has(s.userId)) n.delete(s.userId);
                        else n.add(s.userId);
                        return n;
                      })
                    }
                  />
                  <span className="flex-1">{s.displayName}</span>
                  <span className="hidden text-faint sm:inline">{s.email}</span>
                  {s.alreadyInSession && <span className="text-xs text-faint">Đã có</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {err && <div className="banner-danger mt-3">{err}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          Huỷ
        </button>
        {students && <span className="hidden lg:inline-flex">{save(`Thêm ${picked.size} học viên`)}</span>}
      </div>
      {students && <StickyMobileCTA primary={`Đã chọn ${picked.size} học viên`} action={save("Thêm")} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CandidateTable({
  base,
  rows,
  canEdit,
  hasCourse,
  onPick,
  onChanged,
}: {
  base: string;
  rows: CandidateRow[];
  canEdit: boolean;
  hasCourse: boolean;
  onPick: (p: Panel) => void;
  onChanged: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; msg: string } | null>(null);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return [...rows]
      .sort(byVietnameseName)
      .filter((r) => !k || r.displayName.toLowerCase().includes(k) || (r.mssv ?? "").toLowerCase().includes(k));
  }, [rows, q]);

  const remove = async (r: CandidateRow) => {
    if (!window.confirm(`Xoá ${r.displayName} khỏi ca thi? Mã thi của em này sẽ không dùng được nữa.`)) return;
    try {
      await call(`${base}/${r.id}`, { method: "DELETE" });
      await onChanged();
    } catch (e) {
      setRowErr({ id: r.id, msg: (e as Error).message });
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc MSSV"
            aria-label="Tìm thí sinh theo tên hoặc MSSV"
          />
        </label>
        {canEdit && (
          <>
            {hasCourse && (
              <button className="btn btn-secondary btn-sm" onClick={() => onPick("class")}>
                Lấy từ lớp học
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => onPick("paste")}>
              Dán thêm từ Excel
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onPick("manual")}>
              Thêm một em
            </button>
          </>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-default">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="w-12 px-3 py-2">STT</th>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">MSSV</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phòng</th>
              <th className="px-3 py-2">Mã thi</th>
              {canEdit && <th className="w-20 px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) =>
              editing === r.id ? (
                <EditRow
                  key={r.id}
                  base={base}
                  row={r}
                  index={i + 1}
                  onDone={async () => {
                    setEditing(null);
                    await onChanged();
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <tr key={r.id} className="border-t border-default align-top">
                  <td className="px-3 py-2 text-faint">{i + 1}</td>
                  <td className="px-3 py-2">
                    {r.displayName}
                    {rowErr?.id === r.id && <div className="text-xs font-semibold text-red-700">{rowErr.msg}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono">{r.mssv ?? <span className="text-faint">—</span>}</td>
                  <td className="px-3 py-2 text-faint">{r.email ?? ""}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.roomName ?? <span className="text-faint">Chưa chia</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    {r.accessCode ?? <span className="font-sans text-amber-700">Chưa có, cần MSSV</span>}
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                        onClick={() => {
                          setRowErr(null);
                          setEditing(r.id);
                        }}
                        aria-label={`Sửa ${r.displayName}`}
                        title="Sửa họ tên, MSSV"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => remove(r)}
                        disabled={r.hasAttempt}
                        aria-label={`Xoá ${r.displayName}`}
                        title={r.hasAttempt ? "Em này đã vào thi nên không xoá được" : "Xoá khỏi ca thi"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
            {shown.length === 0 && (
              <tr className="border-t border-default">
                <td colSpan={7} className="px-3 py-6 text-center text-faint">
                  Không có thí sinh nào khớp với “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-faint">
        Cột Phòng sẽ có giá trị sau khi chia phòng. Thí sinh chưa có phòng vẫn vào thi được bằng mã thi, nhưng chưa có trong phiếu mã in theo phòng.
      </p>
    </div>
  );
}

function EditRow({
  base,
  row,
  index,
  onDone,
  onCancel,
}: {
  base: string;
  row: CandidateRow;
  index: number;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(row.displayName);
  const [mssv, setMssv] = useState(row.mssv ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setErr(null);
    setBusy(true);
    try {
      const patch: Record<string, string | null> = {};
      if (name.trim() !== row.displayName) patch.displayName = name;
      if (mssv.trim() !== (row.mssv ?? "")) patch.mssv = mssv.trim() || null;
      if (Object.keys(patch).length) await call(`${base}/${row.id}`, { method: "PATCH", body: patch });
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-default bg-brand-50/40 align-top">
      <td className="px-3 py-2 text-faint">{index}</td>
      <td className="px-3 py-2">
        <input className="input w-full min-w-[10rem]" value={name} onChange={(e) => setName(e.target.value)} aria-label="Họ tên" autoFocus />
        {err && <div className="mt-1 text-xs font-semibold text-red-700">{err}</div>}
      </td>
      <td className="px-3 py-2">
        <input className="input w-32" value={mssv} onChange={(e) => setMssv(e.target.value)} aria-label="MSSV" />
      </td>
      <td className="px-3 py-2 text-faint">{row.email ?? ""}</td>
      <td colSpan={2} className="px-3 py-2" />
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !name.trim()}>
          Lưu
        </button>{" "}
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          Huỷ
        </button>
      </td>
    </tr>
  );
}
