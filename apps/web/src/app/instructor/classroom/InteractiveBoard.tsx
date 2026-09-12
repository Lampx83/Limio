"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import {
  StickyNote, RefreshCw, RotateCcw, EyeOff, Eye, Trash2,
  Plus, X, QrCode, Link as LinkIcon, Image as ImageIcon, Video, Music,
  PanelLeftOpen, PanelLeftClose,
} from "lucide-react";
import { toast } from "@/lib/toast";
import dynamic from "next/dynamic";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { formatVN } from "@/lib/datetime";
import {
  BOARD_NOTE_COLORS,
  rotationForNote,
  detectMediaKind,
  isValidAttachmentUrl,
} from "./boardNoteStyle";
import NoteAttachment from "./NoteAttachment";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white p-3 rounded-lg border border-token" style={{ width: 200, height: 200 }} />
    ),
  },
);

interface BoardNote {
  id: string;
  authorName: string;
  content: string;
  color: string | null;
  attachmentUrl: string | null;
  hidden: boolean;
  createdAt: string;
}

interface Board {
  id: string;
  code: string;
  title: string;
  prompt: string | null;
  status: string;
  notes: BoardNote[];
}

interface BoardHistoryItem {
  id: string;
  code: string;
  title: string;
  status: string;
  createdAt: string;
  _count: { notes: number };
}

interface InteractiveBoardProps {
  onExit?: () => void;
}

export default function InteractiveBoard({ onExit }: InteractiveBoardProps) {
  const [current, setCurrent] = useState<Board | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrPanelOpen, setQrPanelOpen] = useState(true);
  const [history, setHistory] = useState<BoardHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const esRef = useRef<EventSource | null>(null);

  // Immersive: ẩn left sidebar của instructor layout khi board mở,
  // toggle qua body class (CSS rule trong globals.css).
  const [menuHidden, setMenuHidden] = useState(true);

  // Modal post-note state (instructor cũng có thể post để demo / seed)
  const [modalOpen, setModalOpen] = useState(false);
  const [instructorName, setInstructorName] = useState("Giảng viên");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState<string | null>(null);
  const [noteAttachmentUrl, setNoteAttachmentUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [postInfo, setPostInfo] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Toggle body class để CSS ẩn left sidebar (xem globals.css)
  useEffect(() => {
    if (!current) return;
    if (menuHidden) document.body.classList.add("board-immersive");
    else document.body.classList.remove("board-immersive");
    return () => {
      document.body.classList.remove("board-immersive");
    };
  }, [current, menuHidden]);

  // Fetch instructor's display name 1 lần
  useEffect(() => {
    fetch(apiUrl("/api/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.name) setInstructorName(d.name);
        else if (d?.email) setInstructorName(d.email.split("@")[0]);
      })
      .catch(() => {});
  }, []);

  // Helper apply 1 event vào current state
  const applyEvent = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const ev = data as { type?: string; note?: BoardNote; noteId?: string; hidden?: boolean };
    setCurrent((b) => {
      if (!b) return b;
      if (ev.type === "note.created" && ev.note) {
        if (b.notes.some((n) => n.id === ev.note!.id)) return b;
        return { ...b, notes: [...b.notes, { ...ev.note, hidden: false }] };
      }
      if (ev.type === "note.moderated" && ev.noteId) {
        return {
          ...b,
          notes: b.notes.map((n) =>
            n.id === ev.noteId ? { ...n, hidden: ev.hidden ?? n.hidden } : n,
          ),
        };
      }
      if (ev.type === "note.deleted" && ev.noteId) {
        return { ...b, notes: b.notes.filter((n) => n.id !== ev.noteId) };
      }
      if (ev.type === "board.reset") {
        return { ...b, notes: [] };
      }
      return b;
    });
  };

  // SSE live update
  useEffect(() => {
    if (!current) return;
    const code = current.code;
    const es = new EventSource(apiUrl(`/api/public/boards/${code}/stream`));
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        applyEvent(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnect */
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [current?.id]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/boards"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), prompt: prompt.trim() || undefined }),
      });
      if (!res.ok) {
        toast.error((await res.json()).error || "Lỗi tạo board");
        return;
      }
      const created = await res.json();
      // Fetch full detail (gồm notes rỗng)
      const detail = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${created.id}`));
      if (!detail.ok) {
        toast.error("Lỗi tải board");
        return;
      }
      setCurrent(await detail.json());
      setTitle("");
      setPrompt("");
      toast.success("Board tạo thành công");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  // Đóng modal khi Escape
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const handlePostNote = async () => {
    if (!current) return;
    if (!instructorName.trim()) {
      setPostInfo("Vui lòng nhập tên hiển thị");
      return;
    }
    if (!noteContent.trim() && !noteAttachmentUrl.trim()) {
      setPostInfo("Nhập nội dung hoặc đính kèm link");
      return;
    }
    if (noteAttachmentUrl.trim() && !isValidAttachmentUrl(noteAttachmentUrl.trim())) {
      setPostInfo("URL không hợp lệ (chỉ http/https)");
      return;
    }
    setPosting(true);
    setPostInfo(null);
    try {
      const res = await fetch(apiUrl(`/api/public/boards/${current.code}/notes`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: instructorName.trim(),
          content: noteContent.trim() || "",
          ...(noteColor ? { color: noteColor } : {}),
          ...(noteAttachmentUrl.trim() ? { attachmentUrl: noteAttachmentUrl.trim() } : {}),
        }),
      });
      if (res.status === 429) {
        setPostInfo("Gửi quá nhanh — chờ vài giây.");
        return;
      }
      if (!res.ok) {
        setPostInfo("Lỗi gửi note");
        return;
      }
      setNoteContent("");
      setNoteAttachmentUrl("");
      setNoteColor(null);
      setModalOpen(false);
      // SSE sẽ broadcast → applyEvent thêm vào state
    } catch {
      setPostInfo("Lỗi mạng");
    } finally {
      setPosting(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/boards"));
      if (res.ok) setHistory(await res.json());
    } catch {
      toast.error("Lỗi tải lịch sử");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadBoard = async (item: BoardHistoryItem) => {
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${item.id}`));
      if (res.ok) setCurrent(await res.json());
    } catch {
      toast.error("Lỗi tải board");
    }
  };

  const handleToggleHidden = async (note: BoardNote) => {
    if (!current) return;
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/notes/${note.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: !note.hidden }),
        },
      );
      if (!res.ok) toast.error("Lỗi ẩn note");
      // SSE sẽ broadcast event note.moderated → applyEvent cập nhật state
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const handleDeleteNote = async (note: BoardNote) => {
    if (!current) return;
    if (!confirm(`Xóa note "${note.content.slice(0, 30)}..."?`)) return;
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/notes/${note.id}`),
        { method: "DELETE" },
      );
      if (!res.ok) toast.error("Lỗi xóa note");
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const handleCloseBoard = async () => {
    if (!current) return;
    if (!confirm("Đóng board? Sinh viên sẽ không thể post note mới.")) return;
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${current.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      if (res.ok) {
        const upd = await res.json();
        setCurrent((b) => (b ? { ...b, status: upd.status } : b));
        toast.success("Đã đóng board");
      }
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  // Xoá hết note hiện tại nhưng giữ nguyên board (id + code + title/prompt) —
  // dùng lại được cho lớp nhỏ tiếp theo mà không cần tạo board mới.
  const handleReset = async () => {
    if (!current) return;
    if (!confirm("Xoá toàn bộ note hiện tại để bắt đầu phiên mới? Không thể hoàn tác.")) return;
    setIsResetting(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/reset`), {
        method: "POST",
      });
      if (!res.ok) { toast.error("Không thể reset"); return; }
      setCurrent((b) => (b ? { ...b, notes: [] } : b));
      toast.success("Đã reset board");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsResetting(false);
    }
  };

  // Xem shareUrl trong lib/apiUrl.ts — production chạy dưới một tiền tố.
  const joinUrl = current ? shareUrl(`/join/${current.code}`) : null;

  const NotesGrid = ({ notes }: { notes: BoardNote[] }) => {
    const visible = notes; // host thấy hết, kể cả hidden
    if (visible.length === 0) {
      return (
        <div className="text-center py-16">
          <StickyNote size={56} className="mx-auto text-amber-300 mb-3" strokeWidth={1.5} />
          <p className="text-muted text-sm">
            Chưa có note nào. Sinh viên truy cập <code className="font-mono px-1.5 py-0.5 bg-accent-100 rounded">/join/{current?.code}</code> để post.
          </p>
        </div>
      );
    }
    return (
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 px-2 pb-4 [column-fill:_balance]">
        {visible.map((n) => {
          const rot = rotationForNote(n.id);
          return (
            <div
              key={n.id}
              className={`group relative rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.03] hover:z-10 hover:!rotate-0 animate-note-pop-in mb-4 break-inside-avoid overflow-hidden ${n.hidden ? "opacity-40" : ""}`}
              style={{
                backgroundColor: n.color || "#FEF3C7",
                transform: `rotate(${rot})`,
                ["--note-rot" as string]: rot,
              }}
            >
              {n.attachmentUrl && <NoteAttachment url={n.attachmentUrl} />}
              <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
                {n.content}
              </p>
              <p className="text-xs text-gray-700 mt-3 font-semibold tracking-wide">— {n.authorName}</p>
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur rounded-md shadow-sm">
                <button
                  onClick={() => handleToggleHidden(n)}
                  className="p-1.5 hover:bg-white rounded-md"
                  title={n.hidden ? "Hiện" : "Ẩn"}
                >
                  {n.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  onClick={() => handleDeleteNote(n)}
                  className="p-1.5 hover:bg-white rounded-md text-red-600"
                  title="Xóa"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Active board view — same layout as student /join page + moderation ──
  if (current) {
    const visibleCount = current.notes.filter((n) => !n.hidden).length;
    const wrapper = isFullscreen
      ? "fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-amber-50 via-orange-50 to-pink-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900"
      : "relative rounded-2xl overflow-hidden border border-amber-200/60 bg-gradient-to-b from-amber-50 via-orange-50 to-pink-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 shadow-card pb-24";
    const previewKind = noteAttachmentUrl.trim() && isValidAttachmentUrl(noteAttachmentUrl.trim())
      ? detectMediaKind(noteAttachmentUrl.trim())
      : null;
    return (
      <div className={wrapper} data-board="container">
        {/* Compact gradient banner — giống student /join page */}
        <header className="relative bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 text-white px-4 py-5">
          <div className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <div className="relative max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-90 mb-0.5">
                Bảng tương tác · GIẢNG VIÊN
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold drop-shadow-sm break-words leading-tight">
                {current.title}
                {current.status === "closed" && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/30 backdrop-blur font-semibold align-middle">Đã đóng</span>
                )}
              </h1>
              {current.prompt && (
                <p className="mt-1 text-sm italic opacity-95 max-w-2xl">{current.prompt}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setMenuHidden((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur p-2 text-xs font-semibold transition-colors hidden lg:flex"
                title={menuHidden ? "Hiện menu trái" : "Ẩn menu trái (tối ưu không gian)"}
              >
                {menuHidden ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </button>
              <button
                onClick={() => setQrPanelOpen((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title={qrPanelOpen ? "Ẩn khung QR" : "Hiện khung QR"}
              >
                <QrCode size={14} />
                {current.code}
              </button>
              <button
                onClick={() => setIsFullscreen((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors"
              >
                {isFullscreen ? "⛶ Thoát" : "⛶ Full"}
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Xoá toàn bộ note, bắt đầu phiên mới"
              >
                <RotateCcw size={14} className={isResetting ? "animate-spin" : ""} />
                {isResetting ? "..." : "Reset"}
              </button>
              {current.status === "open" && (
                <button
                  onClick={handleCloseBoard}
                  className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors"
                >
                  Đóng board
                </button>
              )}
              {onExit && (
                <button
                  onClick={onExit}
                  className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors"
                >
                  ✕ Exit
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Note count info bar */}
        <div className="max-w-6xl mx-auto px-4 pt-3 text-xs text-muted">
          {visibleCount} note hiển thị · {current.notes.length} tổng (gồm note ẩn)
        </div>

        {/* Masonry — đúng layout student */}
        <main className="max-w-6xl mx-auto p-4">
          <NotesGrid notes={current.notes} />
        </main>

        {/* FAB add note — instructor cũng dùng được để demo */}
        {current.status === "open" && (
          <button
            onClick={() => {
              setModalOpen(true);
              setPostInfo(null);
            }}
            className={`${isFullscreen ? "fixed" : "absolute"} bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-2xl hover:shadow-amber-300/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95`}
            title="Thêm note"
            aria-label="Thêm note"
          >
            <Plus size={32} strokeWidth={3} />
          </button>
        )}

        {/* Khung QR nhỏ, đứng yên góc màn hình — luôn thấy được cùng lúc với các note đổ về,
            khác với modal full-screen cũ vốn che mất NotesGrid. Bấm vào QR để phóng to khi cần
            (vd. lớp đông, học viên ngồi xa). */}
        {qrPanelOpen && joinUrl && (
          <div
            className={`${isFullscreen ? "fixed" : "absolute"} bottom-6 left-6 z-40 flex flex-col items-center gap-1 rounded-xl bg-white p-2.5 shadow-2xl ring-2 ring-amber-200 animate-fade-in-up`}
          >
            <button
              onClick={() => setQrPanelOpen(false)}
              className="absolute -top-2 -right-2 rounded-full bg-white p-1 shadow ring-1 ring-gray-200 hover:bg-gray-100"
              aria-label="Ẩn khung QR"
              title="Ẩn khung QR"
            >
              <X size={12} />
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              title="Bấm để phóng to"
              className="rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            >
              <QRCode value={joinUrl} size={110} level="H" includeMargin />
            </button>
            <p className="text-sm font-extrabold font-mono tracking-[0.15em] text-amber-700">{current.code}</p>
          </div>
        )}

        {/* QR Modal phóng to — bấm vào khung QR góc màn hình hoặc nút mã để hiện QR to hơn */}
        {showQrModal && joinUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in-up p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowQrModal(false); }}
          >
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl max-w-md text-center">
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">Quét để tham gia</p>
              <div className="inline-block bg-white p-4 rounded-xl ring-2 ring-amber-200">
                <QRCode value={joinUrl} size={280} level="H" includeMargin />
              </div>
              <p className="mt-4 text-4xl font-extrabold font-mono tracking-[0.3em] text-amber-700">{current.code}</p>
              <p className="mt-2 text-sm text-gray-600">
                Hoặc truy cập: <code className="font-mono px-1.5 py-0.5 bg-amber-50 rounded">/join/{current.code}</code>
              </p>
              <button
                onClick={async () => {
                  const ok = await copyText(joinUrl);
                  if (ok) toast.success("Đã copy link");
                  else toast.error("Không sao chép được — bạn chọn link rồi copy tay giúp");
                }}
                className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium underline"
              >
                Copy link tham gia
              </button>
            </div>
          </div>
        )}

        {/* Modal post note */}
        {modalOpen && current.status === "open" && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-up"
            onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
          >
            <div
              className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 ring-1 ring-amber-200/60 max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: noteColor || "#FEF3C7" }}
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
                <input
                  type="text"
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  placeholder="Tên hiển thị"
                  maxLength={40}
                  className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Viết note (có thể bỏ trống nếu chỉ đính link)"
                  maxLength={500}
                  rows={3}
                  autoFocus
                  className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
                <div className="relative">
                  <input
                    type="url"
                    value={noteAttachmentUrl}
                    onChange={(e) => setNoteAttachmentUrl(e.target.value)}
                    placeholder="Đính kèm URL: ảnh / video / audio / YouTube / link"
                    maxLength={2000}
                    className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                    {previewKind === "image" ? <ImageIcon size={16} /> :
                     previewKind === "video" || previewKind === "youtube" || previewKind === "vimeo" ? <Video size={16} /> :
                     previewKind === "audio" ? <Music size={16} /> :
                     <LinkIcon size={16} />}
                  </span>
                  {previewKind && (
                    <p className="text-[11px] text-gray-700 mt-1 ml-1">
                      Sẽ hiển thị dạng: <span className="font-semibold">{previewKind === "youtube" ? "YouTube embed" : previewKind === "vimeo" ? "Vimeo embed" : previewKind === "image" ? "Ảnh" : previewKind === "video" ? "Video player" : previewKind === "audio" ? "Audio player" : "Link"}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-700 font-medium mr-1">Màu:</span>
                  {BOARD_NOTE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNoteColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${noteColor === c ? "border-gray-900 scale-110" : "border-white"} shadow`}
                      style={{ backgroundColor: c }}
                      aria-label={`Chọn màu ${c}`}
                    />
                  ))}
                  {noteColor && (
                    <button type="button" onClick={() => setNoteColor(null)} className="text-xs text-gray-700 underline ml-1">
                      Random
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-gray-700">{noteContent.length}/500</p>
                  <button
                    onClick={handlePostNote}
                    disabled={posting}
                    className="bg-gray-900 hover:bg-black text-white font-semibold px-5 py-2 rounded-lg shadow disabled:opacity-50 transition-all"
                  >
                    {posting ? "Đang gửi..." : "📌 Dán note"}
                  </button>
                </div>
                {postInfo && <p className="text-sm text-gray-800 font-medium">{postInfo}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create form — đồng bộ design với board view ──────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200/60 bg-gradient-to-b from-amber-50 via-orange-50 to-pink-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 shadow-card">
      {/* Gradient banner — giống board view */}
      <header className="relative bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 text-white px-6 py-6">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative flex items-center gap-3">
          <div className="bg-white/30 backdrop-blur rounded-xl p-2.5">
            <StickyNote size={28} strokeWidth={2} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-90">Bảng tương tác</p>
            <h2 className="text-xl sm:text-2xl font-extrabold drop-shadow-sm">Tạo bảng mới</h2>
          </div>
        </div>
      </header>

      {/* Body — pastel + inputs trên nền sticky-note màu kem */}
      <div className="p-5 sm:p-6 space-y-5">
        <div className="rounded-2xl bg-[#FEF3C7] p-5 shadow-md ring-1 ring-amber-200/60 space-y-4"
          style={{ transform: "rotate(-0.3deg)" }}
        >
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
              Tiêu đề
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vd. Phản hồi buổi học hôm nay"
              maxLength={120}
              className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
              Câu hỏi gợi ý <span className="text-gray-600 font-medium normal-case tracking-normal">(tùy chọn)</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Vd. Điều bạn nhớ nhất từ buổi học?"
              maxLength={500}
              rows={3}
              className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-2.5 rounded-lg shadow disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isCreating ? "Đang tạo..." : (<><StickyNote size={16} strokeWidth={2.4} /> Tạo Bảng</>)}
          </button>
        </div>

        {/* History section */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">📋 Board đã tạo</p>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <RefreshCw size={12} className={isLoadingHistory ? "animate-spin" : ""} />
              {isLoadingHistory ? "Đang tải..." : "Tải lịch sử"}
            </button>
          </div>
          {history.length === 0 && !isLoadingHistory && (
            <div className="text-center py-6 rounded-xl bg-white/40 dark:bg-black/10 border border-dashed border-amber-200/60">
              <p className="text-xs text-muted">Bấm "Tải lịch sử" để xem board cũ</p>
            </div>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
            {history.map((item, idx) => {
              const bgColors = ["#FEF3C7", "#DBEAFE", "#D1FAE5", "#FCE7F3", "#E9D5FF", "#FED7AA"];
              const bg = bgColors[idx % bgColors.length];
              return (
                <button
                  key={item.id}
                  onClick={() => handleLoadBoard(item)}
                  className="text-left rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] ring-1 ring-black/5"
                  style={{ backgroundColor: bg }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-gray-900 truncate">{item.title}</p>
                    <span className="text-[11px] font-mono font-bold text-gray-800 bg-white/60 px-2 py-0.5 rounded-md shrink-0">
                      {item.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-700 font-medium">
                    {item._count.notes} note · {formatVN(item.createdAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {item.status === "closed" && " · 🔒 Đã đóng"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
