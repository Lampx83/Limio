"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

type Attendance = "present" | "late" | "absent" | "excused" | null;

interface Note {
  id: string;
  userId: string;
  status: "draft" | "approved" | "sent";
  body: string;
  teacherHint: string | null;
  source: string;
  correctionOfId: string | null;
  sentAt: string | null;
  sendError: string | null;
}

interface Row {
  userId: string;
  displayName: string;
  attendance: Attendance;
  kind: "note" | "absent" | "unmarked";
  note: Note | null;
  sentNotes: Note[];
}

export interface NotesView {
  meeting: { id: string; seq: number | null; sectionId: string; sectionName: string; startsAt: string; closedAt: string };
  rows: Row[];
  counts: { draft: number; approved: number; sent: number; failed: number };
}

const ATT_LABEL: Record<string, string> = { present: "Có mặt", late: "Đến muộn", absent: "Vắng", excused: "Vắng có phép" };

/** Ghi chú nhanh (C4.9): bấm để điền, giáo viên vẫn sửa được. Nội dung chỉ là gợi ý, không tự thêm vào nhận xét. */
const CHIPS = [
  "Em phát biểu tích cực trong buổi học.",
  "Em cần chú ý phát âm hơn.",
  "Em hoàn thành bài tập đúng hạn.",
  "Em cần làm bài tập đầy đủ hơn.",
];

const SOURCE_LABEL: Record<string, string> = {
  llm: "AI soạn, thầy/cô duyệt",
  rule_template: "Soạn theo mẫu từ dữ liệu của em",
  manual: "Thầy/cô tự viết",
};

const ERRORS: Record<string, string> = {
  empty_body: "Nhận xét đang trống nên chưa duyệt được.",
  already_sent: "Bản này đã gửi, không sửa được. Muốn đính chính thì bấm \"Đính chính\".",
  absent_student: "Học viên vắng không có nhận xét tự động; thầy/cô có thể viết lời nhắn.",
  attendance_required: "Cần điểm danh em này trước khi soạn nhận xét.",
  validation_failed: "Nội dung chưa hợp lệ (tối đa 4.000 ký tự).",
  forbidden: "Bạn không có quyền với buổi này.",
};
const errText = (c?: string) => ERRORS[c ?? ""] ?? `Có lỗi xảy ra${c ? ` (${c})` : ""}. Thử lại sau.`;

export default function NotesClient({ meetingId, initial, attendanceHref }: { meetingId: string; initial: NotesView; attendanceHref: string }) {
  const [view, setView] = useState(initial);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch(apiUrl(`/api/meetings/${meetingId}/notes`));
    if (r.ok) {
      setView((await r.json()) as NotesView);
      setBodies({});
    }
  }, [meetingId]);

  const call = async (key: string, url: string, method: string, body?: unknown): Promise<Record<string, unknown> | null> => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(apiUrl(url), {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setError(errText(j.error as string | undefined));
        return null;
      }
      return j;
    } catch {
      setError("Chưa thực hiện được vì mạng không ổn định. Nội dung thầy/cô đang gõ vẫn còn, thử lại khi có mạng.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const draftAll = async () => {
    const j = await call("all", `/api/meetings/${meetingId}/notes`, "POST", { action: "draft_all" });
    if (!j) return;
    const fb = ((j.items as Array<{ fallbackReason?: string }>) ?? []).filter((i) => i.fallbackReason && i.fallbackReason !== "no_ai").length;
    setNotice(
      `Đã soạn ${j.drafted} bản nháp${Number(j.kept) ? `, giữ nguyên ${j.kept} bản đã có` : ""}.` +
        (fb ? ` ${fb} bản soạn theo mẫu vì AI chưa dùng được (hết hạn mức hoặc lỗi).` : "") +
        " Thầy/cô đọc, sửa rồi duyệt từng bản.",
    );
    await reload();
  };

  const redraft = async (row: Row) => {
    const j = await call(row.userId, `/api/meetings/${meetingId}/notes`, "POST", {
      action: "draft_one",
      userId: row.userId,
      hint: hints[row.userId] ?? row.note?.teacherHint ?? null,
      regenerate: true,
    });
    if (j) await reload();
  };

  const draftOne = async (row: Row) => {
    const j = await call(row.userId, `/api/meetings/${meetingId}/notes`, "POST", {
      action: "draft_one",
      userId: row.userId,
      hint: hints[row.userId] ?? null,
    });
    if (j) await reload();
  };

  const saveManual = async (row: Row) => {
    const body = bodies[row.userId] ?? row.note?.body ?? "";
    const j = await call(row.userId, `/api/meetings/${meetingId}/notes`, "PUT", { userId: row.userId, body, teacherHint: hints[row.userId] ?? undefined });
    if (j) {
      setNotice("Đã lưu bản nháp.");
      await reload();
    }
  };

  const approve = async (note: Note) => {
    const body = bodies[note.userId];
    const j = await call(note.id, `/api/meeting-notes/${note.id}`, "PATCH", { ...(body !== undefined && body !== note.body ? { body } : {}), action: "approve" });
    if (j) await reload();
  };

  const unapprove = async (note: Note) => {
    const j = await call(note.id, `/api/meeting-notes/${note.id}`, "PATCH", { action: "unapprove" });
    if (j) await reload();
  };

  const correct = async (note: Note) => {
    const j = await call(note.id, `/api/meeting-notes/${note.id}/correction`, "POST");
    if (j) {
      setNotice("Đã tạo bản đính chính. Sửa nội dung, duyệt rồi gửi.");
      await reload();
    }
  };

  const sendApproved = async () => {
    const n = view.counts.approved;
    if (!window.confirm(`Gửi ${n} nhận xét đã duyệt tới email của học viên? Các bản nháp chưa duyệt sẽ không được gửi.`)) return;
    const j = await call("send", `/api/meetings/${meetingId}/notes/send`, "POST");
    if (j) {
      setNotice("Đang gửi các bản đã duyệt. Bản nào lỗi sẽ hiện lại ở đây để gửi lại.");
      setTimeout(reload, 4000);
    }
  };

  const eligible = view.rows.filter((r) => r.kind === "note");
  const withNotes = view.rows.filter((r) => r.kind === "note");

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={busy !== null || eligible.length === 0} onClick={draftAll}>
          Soạn nháp cho cả lớp
        </button>
        <button type="button" className="btn-primary" disabled={busy !== null || view.counts.approved === 0} onClick={sendApproved}>
          Gửi tất cả đã duyệt ({view.counts.approved})
        </button>
        <p className="text-meta text-muted">
          {view.counts.draft} nháp · {view.counts.approved} đã duyệt chờ gửi · {view.counts.sent} đã gửi
          {view.counts.failed > 0 ? ` · ${view.counts.failed} gửi lỗi` : ""}
        </p>
      </div>
      <p className="mt-2 text-meta text-muted">
        Bản nháp chỉ dựa trên điểm danh, bài tập và mức nắm bài của chính em đó; không nhắc em khác. Bản nháp không bao giờ tự gửi: thầy/cô đọc, sửa
        và bấm duyệt.
      </p>
      {error && <p className="banner-danger mt-3" role="alert">{error}</p>}
      {notice && <p className="banner-success mt-3" role="status">{notice}</p>}

      <ul className="mt-4 flex flex-col gap-3">
        {view.rows.map((row) => {
          const note = row.note;
          const text = bodies[row.userId] ?? note?.body ?? "";
          const hint = hints[row.userId] ?? note?.teacherHint ?? "";
          const isBusy = busy === row.userId || busy === note?.id;
          return (
            <li key={row.userId} className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.displayName}</span>
                {row.attendance && <span className="chip text-xs">{ATT_LABEL[row.attendance]}</span>}
                {note && (
                  <span className={`text-xs ${note.status === "approved" ? "chip-success" : "chip"}`}>
                    {note.correctionOfId ? "Đính chính · " : ""}
                    {note.status === "approved" ? "Đã duyệt" : "Nháp"}
                  </span>
                )}
                {!note && row.sentNotes.length > 0 && <span className="chip-brand text-xs">Đã gửi</span>}
              </div>

              {row.kind === "unmarked" && (
                <p className="mt-2 text-meta text-muted">
                  Chưa điểm danh em này. Điểm danh ở trang <Link href={attendanceHref} className="underline">Điểm danh</Link> rồi mới soạn nhận xét.
                </p>
              )}

              {row.kind === "absent" && !note && row.sentNotes.length === 0 && (
                <div className="mt-2">
                  <p className="text-meta text-muted">Em vắng nên không có nhận xét tự động; em nhận email tổng kết chung kèm bài cần học bù. Thầy/cô có thể thêm lời nhắn riêng.</p>
                  <textarea
                    className="input mt-2 w-full"
                    rows={2}
                    maxLength={4000}
                    placeholder="Lời nhắn riêng cho em (không bắt buộc)"
                    value={bodies[row.userId] ?? ""}
                    onChange={(e) => setBodies((b) => ({ ...b, [row.userId]: e.target.value }))}
                  />
                  <button type="button" className="btn-secondary btn-sm mt-2" disabled={isBusy || !(bodies[row.userId] ?? "").trim()} onClick={() => saveManual(row)}>
                    Lưu lời nhắn
                  </button>
                </div>
              )}

              {(row.kind === "note" || (row.kind === "absent" && note)) && !note && row.sentNotes.length === 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="input min-w-0 flex-1"
                    placeholder="Ghi chú nhanh để AI đưa vào (không bắt buộc)"
                    maxLength={500}
                    value={hints[row.userId] ?? ""}
                    onChange={(e) => setHints((h) => ({ ...h, [row.userId]: e.target.value }))}
                  />
                  <button type="button" className="btn-secondary btn-sm" disabled={isBusy} onClick={() => draftOne(row)}>
                    Soạn nháp
                  </button>
                </div>
              )}

              {note && (
                <div className="mt-2">
                  <textarea
                    className="input w-full"
                    rows={5}
                    maxLength={4000}
                    value={text}
                    placeholder="Chưa có đủ dữ liệu để soạn tự động. Thầy/cô viết nhận xét ở đây."
                    onChange={(e) => setBodies((b) => ({ ...b, [row.userId]: e.target.value }))}
                  />
                  <p className="mt-1 text-meta text-faint">{SOURCE_LABEL[note.source] ?? note.source}</p>
                  {note.sendError && note.sendError !== "email_optout" && (
                    <p className="banner-danger mt-2" role="alert">Gửi lỗi: {note.sendError}. Bấm "Gửi tất cả đã duyệt" để gửi lại.</p>
                  )}
                  {row.kind === "note" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CHIPS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="chip text-xs hover:border-brand-300"
                          onClick={() => setHints((h) => ({ ...h, [row.userId]: c }))}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {row.kind === "note" && (
                      <input
                        className="input min-w-0 flex-1"
                        placeholder="Ghi chú nhanh rồi bấm Soạn lại"
                        maxLength={500}
                        value={hint}
                        onChange={(e) => setHints((h) => ({ ...h, [row.userId]: e.target.value }))}
                      />
                    )}
                    {row.kind === "note" && (
                      <button type="button" className="btn-secondary btn-sm" disabled={isBusy} onClick={() => redraft(row)}>
                        Soạn lại
                      </button>
                    )}
                    {bodies[row.userId] !== undefined && bodies[row.userId] !== note.body && (
                      <button type="button" className="btn-ghost btn-sm" disabled={isBusy} onClick={() => saveManual(row)}>
                        Lưu nháp
                      </button>
                    )}
                    {note.status === "draft" ? (
                      <button type="button" className="btn-primary btn-sm" disabled={isBusy || !text.trim()} onClick={() => approve(note)}>
                        Duyệt
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary btn-sm" disabled={isBusy} onClick={() => unapprove(note)}>
                        Bỏ duyệt
                      </button>
                    )}
                  </div>
                </div>
              )}

              {row.sentNotes.map((s) => (
                <div key={s.id} className="mt-3 rounded-lg border border-token p-3">
                  <p className="text-meta text-muted">
                    {s.correctionOfId ? "Bản đính chính đã gửi" : "Đã gửi"}
                    {s.sentAt ? ` lúc ${new Date(s.sentAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""}
                    {s.sendError === "email_optout" ? " · học viên đã tắt email, đọc trong ứng dụng" : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{s.body}</p>
                  {!row.note && (
                    <button type="button" className="btn-ghost btn-sm mt-2" disabled={busy !== null} onClick={() => correct(s)}>
                      Đính chính
                    </button>
                  )}
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      {withNotes.length === 0 && <p className="mt-4 text-meta text-muted">Buổi này chưa có học viên nào có mặt hoặc đến muộn.</p>}
    </div>
  );
}
