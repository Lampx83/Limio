"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, X, Pencil, Link as LinkIcon, Image as ImageIcon, Video, Music } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import {
  BOARD_NOTE_COLORS,
  rotationForNote,
  detectMediaKind,
  isValidAttachmentUrl,
  groupNotesByColumn,
  columnHeaderColor,
} from "@/app/instructor/classroom/boardNoteStyle";
import NoteAttachment from "@/app/instructor/classroom/NoteAttachment";

interface BoardNote {
  id: string;
  authorName: string;
  content: string;
  color: string | null;
  attachmentUrl: string | null;
  column: string | null;
  createdAt: string;
}

interface Board {
  id: string;
  code: string;
  title: string;
  prompt: string | null;
  status: string;
  columns: string[];
  blockPaste: boolean;
  notes: BoardNote[];
}

const STORAGE_KEY_NAME = "fbm-board-name";
const STORAGE_KEY_GROUP_PREFIX = "fbm-board-group-";
const STORAGE_KEY_MYNOTES_PREFIX = "fbm-board-mynotes-";
const MAX_TRACKED_MY_NOTES = 200;

// Note của "tôi" — nhận diện bằng id lưu ở localStorage của chính trình duyệt đã tạo note
// đó (không xác thực server-side, cùng cơ chế trust-based với việc tự chọn nhóm lúc post).
// Không giới hạn theo thời gian: sửa được bất cứ lúc nào trên chính máy đã đăng.
function readMyNoteIds(code: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MYNOTES_PREFIX + code);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberMyNoteId(code: string, noteId: string) {
  if (typeof window === "undefined") return;
  const ids = [...readMyNoteIds(code), noteId].slice(-MAX_TRACKED_MY_NOTES);
  localStorage.setItem(STORAGE_KEY_MYNOTES_PREFIX + code, JSON.stringify(ids));
}

// showColumnTag: hiện pill nhỏ ghi tên nhóm — dùng khi board không còn ở chế độ grid
// (cột đã tắt/xoá) nhưng note cũ vẫn giữ nhãn cột gốc.
function NoteCard({
  n,
  showColumnTag,
  canEdit,
  onEdit,
}: {
  n: BoardNote;
  showColumnTag?: boolean;
  canEdit?: boolean;
  onEdit?: (n: BoardNote) => void;
}) {
  const rot = rotationForNote(n.id);
  return (
    <div
      className="group relative rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.03] hover:!rotate-0 animate-note-pop-in mb-4 break-inside-avoid overflow-hidden"
      style={{
        backgroundColor: n.color || "#FEF3C7",
        transform: `rotate(${rot})`,
        ["--note-rot" as string]: rot,
      }}
    >
      {showColumnTag && n.column && (
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/10 text-gray-800 mb-1.5">
          {n.column}
        </span>
      )}
      {n.attachmentUrl && <NoteAttachment url={n.attachmentUrl} />}
      {n.content && (
        <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
          {n.content}
        </p>
      )}
      <p className="text-xs text-gray-700 mt-3 font-semibold tracking-wide">— {n.authorName}</p>
      {canEdit && onEdit && (
        <button
          onClick={() => onEdit(n)}
          className="absolute top-1.5 right-1.5 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur rounded-md shadow-sm hover:bg-white"
          title="Sửa note của bạn"
          aria-label="Sửa note của bạn"
        >
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}

export default function JoinBoardPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state — chỉ hiện khi modal open
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [groupColumn, setGroupColumn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [myNoteIds, setMyNoteIds] = useState<Set<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);

  // Modal sửa note — chỉ cho note "của tôi" (xem readMyNoteIds ở trên).
  const [editingNote, setEditingNote] = useState<BoardNote | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editAttachmentUrl, setEditAttachmentUrl] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editInfo, setEditInfo] = useState<string | null>(null);

  // Restore name từ localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_NAME);
      if (saved) setName(saved);
    }
  }, []);

  // Nạp danh sách note "của tôi" trên board này (để hiện nút sửa) — riêng theo từng
  // board.code vì cùng trình duyệt có thể join nhiều board khác nhau.
  useEffect(() => {
    if (!board) return;
    setMyNoteIds(readMyNoteIds(board.code));
  }, [board?.code]);

  // Restore nhóm đã chọn lần trước cho đúng board này — học viên tự biết nhóm mình,
  // không có xác thực, chỉ nhớ giúp đỡ phải chọn lại mỗi lần post.
  useEffect(() => {
    if (!board || board.columns.length === 0 || typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY_GROUP_PREFIX + board.code);
    if (saved && board.columns.includes(saved)) {
      setGroupColumn(saved);
    } else if (!board.columns.includes(groupColumn)) {
      setGroupColumn(board.columns[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.code, board?.columns.join("|")]);

  // Initial snapshot
  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/public/boards/${code}`));
        if (res.status === 404) {
          setError("Không tìm thấy board với code này.");
          return;
        }
        if (!res.ok) {
          setError("Lỗi tải board");
          return;
        }
        setBoard(await res.json());
      } catch {
        setError("Lỗi mạng");
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  // SSE live
  useEffect(() => {
    if (!board) return;
    const es = new EventSource(apiUrl(`/api/public/boards/${code}/stream`));
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as {
          type?: string;
          note?: BoardNote;
          noteId?: string;
          hidden?: boolean;
        };
        setBoard((b) => {
          if (!b) return b;
          if (ev.type === "note.created" && ev.note) {
            if (b.notes.some((n) => n.id === ev.note!.id)) return b;
            return { ...b, notes: [...b.notes, ev.note] };
          }
          if (ev.type === "note.updated" && ev.note) {
            return {
              ...b,
              notes: b.notes.map((n) => (n.id === ev.note!.id ? { ...n, ...ev.note } : n)),
            };
          }
          if (ev.type === "note.deleted" && ev.noteId) {
            return { ...b, notes: b.notes.filter((n) => n.id !== ev.noteId) };
          }
          if (ev.type === "note.moderated" && ev.noteId && ev.hidden) {
            return { ...b, notes: b.notes.filter((n) => n.id !== ev.noteId) };
          }
          if (ev.type === "board.reset") {
            return { ...b, notes: [] };
          }
          return b;
        });
      } catch {
        /* ignore */
      }
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [board?.id, code]);

  // Đóng modal khi bấm Escape
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  useEffect(() => {
    if (!editingNote) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingNote(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingNote]);

  const openEditNote = (n: BoardNote) => {
    setEditingNote(n);
    setEditContent(n.content);
    setEditAttachmentUrl(n.attachmentUrl || "");
    setEditColor(n.color);
    setEditInfo(null);
  };

  // Nút "+" ngay trong từng ô grid — chọn sẵn nhóm của cột đó rồi mở modal, song song
  // với nút "+" tổng ở góc màn hình (nút tổng giữ nguyên nhóm đã chọn/nhớ trước đó).
  const openComposeForColumn = (column: string) => {
    setGroupColumn(column);
    setModalOpen(true);
    setInfo(null);
  };

  const handleSaveEditNote = async () => {
    if (!editingNote) return;
    if (!editContent.trim() && !editAttachmentUrl.trim()) {
      setEditInfo("Nhập nội dung hoặc đính kèm link");
      return;
    }
    if (editAttachmentUrl.trim() && !isValidAttachmentUrl(editAttachmentUrl.trim())) {
      setEditInfo("URL không hợp lệ (chỉ http/https)");
      return;
    }
    setEditSubmitting(true);
    setEditInfo(null);
    try {
      const res = await fetch(apiUrl(`/api/public/boards/${code}/notes/${editingNote.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent.trim(),
          attachmentUrl: editAttachmentUrl.trim(),
          ...(editColor ? { color: editColor } : {}),
        }),
      });
      if (res.status === 429) {
        setEditInfo("Bạn sửa quá nhanh — chờ vài giây rồi thử lại.");
        return;
      }
      if (!res.ok) {
        setEditInfo("Lỗi lưu note");
        return;
      }
      setEditingNote(null);
      // SSE sẽ broadcast event note.updated → cập nhật state
    } catch {
      setEditInfo("Lỗi mạng");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setInfo("Vui lòng nhập tên hiển thị");
      return;
    }
    if (!content.trim() && !attachmentUrl.trim()) {
      setInfo("Vui lòng nhập nội dung hoặc đính kèm link");
      return;
    }
    if (attachmentUrl.trim() && !isValidAttachmentUrl(attachmentUrl.trim())) {
      setInfo("URL không hợp lệ (chỉ chấp nhận http/https)");
      return;
    }
    if (board && board.columns.length > 0 && !groupColumn) {
      setInfo("Vui lòng chọn nhóm của bạn");
      return;
    }
    setSubmitting(true);
    setInfo(null);
    try {
      const res = await fetch(apiUrl(`/api/public/boards/${code}/notes`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: name.trim(),
          content: content.trim() || "",
          ...(color ? { color } : {}),
          ...(attachmentUrl.trim() ? { attachmentUrl: attachmentUrl.trim() } : {}),
          ...(board && board.columns.length > 0 ? { column: groupColumn } : {}),
        }),
      });
      if (res.status === 429) {
        setInfo("Bạn gửi quá nhanh — chờ vài giây rồi thử lại.");
        return;
      }
      if (res.status === 403) {
        const err = (await res.json()).error;
        if (err === "board_closed") setInfo("Board đã đóng.");
        else if (err === "board_full") setInfo("Board đã đầy.");
        else setInfo("Không gửi được note.");
        return;
      }
      if (!res.ok) {
        setInfo("Lỗi gửi note");
        return;
      }
      const created = (await res.json()) as BoardNote;
      localStorage.setItem(STORAGE_KEY_NAME, name.trim());
      if (board && board.columns.length > 0) {
        localStorage.setItem(STORAGE_KEY_GROUP_PREFIX + board.code, groupColumn);
      }
      if (board) {
        rememberMyNoteId(board.code, created.id);
        setMyNoteIds((s) => new Set(s).add(created.id));
      }
      setContent("");
      setAttachmentUrl("");
      setColor(null);
      setModalOpen(false);
      // Note sẽ xuất hiện via SSE
    } catch {
      setInfo("Lỗi mạng");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted">Đang tải...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Không vào được</h1>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!board) return null;

  // Smart icon next to URL field — gợi ý loại đính kèm
  const previewKind = attachmentUrl.trim() && isValidAttachmentUrl(attachmentUrl.trim())
    ? detectMediaKind(attachmentUrl.trim())
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-pink-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 pb-24">
      {/* Compact gradient header — nhỏ hơn bản trước để dành đất cho note */}
      <header className="relative bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 text-white px-4 py-5">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-90 mb-0.5">Bảng tương tác</p>
            <h1 className="text-xl sm:text-2xl font-extrabold drop-shadow-sm break-words leading-tight">{board.title}</h1>
            {board.prompt && (
              <p className="mt-1 text-sm italic opacity-95 max-w-2xl">{board.prompt}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase opacity-80">Code</p>
            <p className="font-mono text-sm font-bold tracking-widest">{board.code}</p>
            <p className="text-[10px] opacity-80 mt-0.5">{board.notes.length} note</p>
          </div>
        </div>
      </header>

      {board.status !== "open" && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="rounded-xl bg-amber-100 border border-amber-300 p-3 text-center text-sm text-amber-900">
            🔒 Board này đã đóng. Bạn chỉ có thể xem note hiện có.
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4">
        {board.columns.length > 0 ? (
          // Hiện đủ cột GV đã đặt ngay từ đầu (kể cả 0 note), không đợi có note đầu tiên.
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {groupNotesByColumn(board.notes, board.columns).map((g) => {
              const color = columnHeaderColor(board.columns.indexOf(g.label));
              return (
                <div
                  key={g.label}
                  className="w-72 shrink-0 flex flex-col rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-sm bg-white/60 dark:bg-white/[0.03]"
                >
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                    style={{ backgroundColor: color }}
                  >
                    <p className="text-sm font-bold text-gray-900 truncate">{g.label}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-bold text-gray-800 bg-white/70 rounded-full px-2 py-0.5">
                        {g.notes.length}
                      </span>
                      {board.status === "open" && board.columns.includes(g.label) && (
                        <button
                          onClick={() => openComposeForColumn(g.label)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-md transition-all hover:scale-110 active:scale-95"
                          title={`Thêm note vào ${g.label}`}
                          aria-label={`Thêm note vào ${g.label}`}
                        >
                          <Plus size={18} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-0 p-3 min-h-[96px]">
                    {g.notes.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 text-xs text-muted italic py-6">
                        Chưa có note
                      </div>
                    ) : (
                      g.notes.map((n) => (
                        <NoteCard key={n.id} n={n} canEdit={board.status === "open" && myNoteIds.has(n.id)} onEdit={openEditNote} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : board.notes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-6xl mb-3">📝</p>
            <p className="text-sm text-muted">Chưa có note nào — bấm <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-white font-bold mx-1">+</span> để đăng note đầu tiên!</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:_balance]">
            {board.notes.map((n) => (
              <NoteCard key={n.id} n={n} showColumnTag canEdit={board.status === "open" && myNoteIds.has(n.id)} onEdit={openEditNote} />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button — chỉ hiện khi board đang open */}
      {board.status === "open" && (
        <button
          onClick={() => {
            setModalOpen(true);
            setInfo(null);
          }}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-2xl hover:shadow-amber-300/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          title="Thêm note (N)"
          aria-label="Thêm note"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      )}

      {/* Modal sửa note — chỉ cho note "của tôi" trên chính trình duyệt này */}
      {editingNote && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-up"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingNote(null); }}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 ring-1 ring-amber-200/60 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: editColor || "#FEF3C7" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pencil size={18} /> Sửa note
              </h2>
              <button
                onClick={() => setEditingNote(null)}
                className="p-1.5 rounded-lg hover:bg-white/40"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nội dung
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onPaste={board.blockPaste ? (e) => e.preventDefault() : undefined}
                  placeholder="Viết note (có thể bỏ trống nếu chỉ đính link)"
                  maxLength={500}
                  rows={3}
                  autoFocus
                  className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
                {board.blockPaste && (
                  <p className="text-[11px] text-gray-500 mt-1 ml-1">GV đã tắt dán — vui lòng tự gõ nội dung.</p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Đính kèm <span className="text-gray-500 font-medium normal-case tracking-normal">(tùy chọn)</span>
                </label>
                <input
                  type="url"
                  value={editAttachmentUrl}
                  onChange={(e) => setEditAttachmentUrl(e.target.value)}
                  placeholder="Ảnh / video / audio / YouTube / link"
                  maxLength={2000}
                  className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mr-1">Màu:</span>
                {BOARD_NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${editColor === c ? "border-gray-900 scale-110" : "border-white"} shadow`}
                    style={{ backgroundColor: c }}
                    aria-label={`Chọn màu ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-gray-700">{editContent.length}/500</p>
                <button
                  onClick={handleSaveEditNote}
                  disabled={editSubmitting}
                  className="bg-gray-900 hover:bg-black text-white font-semibold px-5 py-2 rounded-lg shadow disabled:opacity-50 transition-all"
                >
                  {editSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
              {editInfo && <p className="text-sm text-gray-800 font-medium">{editInfo}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && board.status === "open" && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-up"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 ring-1 ring-amber-200/60 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: color || "#FEF3C7" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">📌 Thêm note</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/40"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vd. Nguyễn Văn A"
                  maxLength={40}
                  className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {board.columns.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Thuộc nhóm
                  </label>
                  <select
                    value={groupColumn}
                    onChange={(e) => setGroupColumn(e.target.value)}
                    className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {board.columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nội dung
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={board.blockPaste ? (e) => e.preventDefault() : undefined}
                  placeholder="Viết note (có thể bỏ trống nếu chỉ đính link)"
                  maxLength={500}
                  rows={3}
                  autoFocus
                  className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
                {board.blockPaste && (
                  <p className="text-[11px] text-gray-500 mt-1 ml-1">GV đã tắt dán — vui lòng tự gõ nội dung.</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Đính kèm <span className="text-gray-500 font-medium normal-case tracking-normal">(tùy chọn)</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="Ảnh / video / audio / YouTube / link"
                    maxLength={2000}
                    className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                    {previewKind === "image" ? <ImageIcon size={16} /> :
                     previewKind === "video" || previewKind === "youtube" || previewKind === "vimeo" ? <Video size={16} /> :
                     previewKind === "audio" ? <Music size={16} /> :
                     <LinkIcon size={16} />}
                  </span>
                </div>
                {previewKind && (
                  <p className="text-[11px] text-gray-700 mt-1 ml-1">
                    Sẽ hiển thị dạng: <span className="font-semibold">{previewKind === "youtube" ? "YouTube embed" : previewKind === "vimeo" ? "Vimeo embed" : previewKind === "image" ? "Ảnh" : previewKind === "video" ? "Video player" : previewKind === "audio" ? "Audio player" : "Link"}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mr-1">Màu:</span>
                {BOARD_NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-gray-900 scale-110" : "border-white"} shadow`}
                    style={{ backgroundColor: c }}
                    aria-label={`Chọn màu ${c}`}
                  />
                ))}
                {color && (
                  <button
                    type="button"
                    onClick={() => setColor(null)}
                    className="text-xs text-gray-700 underline ml-1"
                  >
                    Random
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-gray-700">{content.length}/500</p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-gray-900 hover:bg-black text-white font-semibold px-5 py-2 rounded-lg shadow disabled:opacity-50 transition-all"
                >
                  {submitting ? "Đang gửi..." : "📌 Dán note"}
                </button>
              </div>
              {info && <p className="text-sm text-gray-800 font-medium">{info}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
