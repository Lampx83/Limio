"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { BOARD_NOTE_COLORS, rotationForNote } from "@/app/instructor/classroom/boardNoteStyle";

interface BoardNote {
  id: string;
  authorName: string;
  content: string;
  color: string | null;
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

const STORAGE_KEY_NAME = "fbm-board-name";

export default function JoinBoardPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Restore name từ localStorage (sinh viên không phải nhập lại mỗi lần)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_NAME);
      if (saved) setName(saved);
    }
  }, []);

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
          if (ev.type === "note.deleted" && ev.noteId) {
            return { ...b, notes: b.notes.filter((n) => n.id !== ev.noteId) };
          }
          if (ev.type === "note.moderated" && ev.noteId && ev.hidden) {
            // Hidden → ẩn khỏi public view
            return { ...b, notes: b.notes.filter((n) => n.id !== ev.noteId) };
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

  const handleSubmit = async () => {
    if (!name.trim()) {
      setInfo("Vui lòng nhập tên hiển thị");
      return;
    }
    if (!content.trim()) {
      setInfo("Vui lòng nhập nội dung");
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
          content: content.trim(),
          ...(color ? { color } : {}),
        }),
      });
      if (res.status === 429) {
        setInfo("Bạn gửi quá nhanh — chờ vài giây rồi thử lại.");
        return;
      }
      if (res.status === 403) {
        const err = (await res.json()).error;
        if (err === "board_closed") setInfo("Board đã đóng, không nhận note mới.");
        else if (err === "board_full") setInfo("Board đã đầy (2000 note).");
        else setInfo("Không gửi được note.");
        return;
      }
      if (!res.ok) {
        setInfo("Lỗi gửi note");
        return;
      }
      localStorage.setItem(STORAGE_KEY_NAME, name.trim());
      setContent("");
      setInfo("Đã gửi ✓");
      // Note sẽ xuất hiện via SSE; không cần update state local
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-pink-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900">
      {/* Gradient banner header */}
      <header className="relative bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 text-white px-4 py-8 sm:py-10">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.3em] font-semibold opacity-90 mb-2">Bảng tương tác</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold drop-shadow-sm break-words">{board.title}</h1>
          {board.prompt && (
            <p className="mt-3 text-base sm:text-lg italic opacity-95 max-w-2xl mx-auto">{board.prompt}</p>
          )}
          <p className="mt-4 text-xs opacity-80 font-mono tracking-widest">CODE · {board.code}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {board.status !== "open" && (
          <div className="rounded-xl bg-amber-100 border border-amber-300 p-3 text-center text-sm text-amber-900">
            🔒 Board này đã đóng. Bạn chỉ có thể xem note hiện có.
          </div>
        )}

        {board.status === "open" && (
          <div
            className="rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg ring-1 ring-amber-200/60"
            style={{ backgroundColor: color || "#FEF3C7" }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên hiển thị"
              maxLength={40}
              className="w-full bg-white/60 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Viết note của bạn ở đây..."
              maxLength={500}
              rows={3}
              className="w-full bg-white/60 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-700 font-medium mr-1">Màu:</span>
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
            <div className="flex items-center justify-between gap-2">
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
        )}

        <div>
          <p className="text-sm text-muted mb-3 font-semibold">{board.notes.length} note</p>
          {board.notes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-3">📝</p>
              <p className="text-sm text-muted">Chưa có note nào — hãy là người đầu tiên!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {board.notes.map((n) => {
                const rot = rotationForNote(n.id);
                return (
                  <div
                    key={n.id}
                    className="group rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.03] hover:!rotate-0 animate-note-pop-in"
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
