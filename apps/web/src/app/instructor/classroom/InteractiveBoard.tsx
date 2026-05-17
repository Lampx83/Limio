"use client";

import { useEffect, useRef, useState } from "react";
import { StickyNote, RefreshCw, EyeOff, Eye, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { rotationForNote } from "./boardNoteStyle";

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
  const [history, setHistory] = useState<BoardHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const esRef = useRef<EventSource | null>(null);

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

  const joinUrl =
    current && typeof window !== "undefined"
      ? `${window.location.origin}/join/${current.code}`
      : null;

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
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 px-2 pb-4">
        {visible.map((n) => {
          const rot = rotationForNote(n.id);
          return (
            <div
              key={n.id}
              className={`group relative rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.03] hover:z-10 hover:!rotate-0 animate-note-pop-in ${n.hidden ? "opacity-40" : ""}`}
              style={{
                backgroundColor: n.color || "#FEF3C7",
                transform: `rotate(${rot})`,
                ["--note-rot" as string]: rot,
              }}
            >
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

  // ── Active board view ────────────────────────────────────────────────────
  if (current) {
    const visibleCount = current.notes.filter((n) => !n.hidden).length;
    const wrapper = isFullscreen
      ? "fixed inset-0 bg-[rgb(var(--surface-muted))] flex flex-col z-50 overflow-y-auto"
      : "rounded-2xl overflow-hidden border border-amber-200/60 bg-[rgb(var(--surface-muted))] shadow-card";
    return (
      <div className={wrapper}>
        {/* Header gradient banner — cảm hứng Padlet */}
        <div className="relative bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <StickyNote size={22} strokeWidth={2.2} />
                <span className="text-xs uppercase tracking-widest font-semibold opacity-90">Bảng tương tác</span>
                {current.status === "closed" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 backdrop-blur font-semibold">Đã đóng</span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold drop-shadow-sm break-words">
                {current.title}
              </h2>
              {current.prompt && (
                <p className="mt-2 text-sm md:text-base opacity-95 italic max-w-2xl">{current.prompt}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => setIsFullscreen((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                {isFullscreen ? "⛶ Thoát" : "⛶ Full"}
              </button>
              {current.status === "open" && (
                <button
                  onClick={handleCloseBoard}
                  className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  Đóng board
                </button>
              )}
              {onExit && (
                <button
                  onClick={onExit}
                  className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  ✕ Exit
                </button>
              )}
            </div>
          </div>
        </div>

        {joinUrl && (
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center border-b border-amber-200/40 bg-white/40 dark:bg-black/10 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-xl shadow-md ring-1 ring-amber-200">
                <QRCode value={joinUrl} size={120} level="H" includeMargin />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Mã tham gia</p>
                <p className="text-3xl font-extrabold font-mono tracking-[0.3em] text-amber-700">{current.code}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    toast.success("Đã copy link");
                  }}
                  className="mt-1 text-xs text-brand-600 hover:text-brand-700 font-medium underline"
                >
                  Copy link
                </button>
              </div>
            </div>
            <div className="text-sm text-muted md:text-right">
              <p className="font-semibold text-base text-foreground">{visibleCount} note hiển thị</p>
              <p className="mt-0.5">{current.notes.length} tổng cộng (gồm cả note ẩn)</p>
              <p className="mt-1 text-xs">Sinh viên: <code className="font-mono px-1.5 py-0.5 bg-accent-100 dark:bg-accent-900/30 rounded">/join/{current.code}</code> hoặc quét QR</p>
            </div>
          </div>
        )}

        <div className="p-4">
          <NotesGrid notes={current.notes} />
        </div>
      </div>
    );
  }

  // ── Create form ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-[rgb(var(--surface))] p-6 shadow-card">
      <div className="flex items-center gap-2">
        <StickyNote size={24} className="text-amber-600" strokeWidth={1.5} />
        <h3 className="text-lg font-bold">Tạo Bảng Tương Tác</h3>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Tiêu đề</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vd. Phản hồi buổi học hôm nay"
            maxLength={120}
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Câu hỏi gợi ý (tùy chọn)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Vd. Điều bạn nhớ nhất từ buổi học?"
            maxLength={500}
            rows={3}
            className="input w-full"
          />
        </div>
        <button onClick={handleCreate} disabled={isCreating} className="btn-primary w-full">
          {isCreating ? "Đang tạo..." : "Tạo Bảng"}
        </button>
      </div>

      <div className="mt-6 border-t border-token pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted">Board đã tạo</p>
          <button
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="btn-secondary btn-sm text-xs flex items-center gap-1"
          >
            <RefreshCw size={11} className={isLoadingHistory ? "animate-spin" : ""} />
            {isLoadingHistory ? "Đang tải..." : "Tải lịch sử"}
          </button>
        </div>
        {history.length === 0 && !isLoadingHistory && (
          <p className="text-xs text-muted text-center py-2">Bấm "Tải lịch sử" để xem board cũ</p>
        )}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => handleLoadBoard(item)}
              className="w-full text-left rounded-lg border border-token p-3 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <span className="text-xs font-mono text-muted">{item.code}</span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {item._count.notes} note · {new Date(item.createdAt).toLocaleString("vi-VN")}
                {item.status === "closed" && " · Đã đóng"}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
