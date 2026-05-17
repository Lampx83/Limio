"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

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
        body: JSON.stringify({ authorName: name.trim(), content: content.trim() }),
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
    <div className="min-h-screen bg-[rgb(var(--surface-muted))] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold">{board.title}</h1>
          {board.prompt && <p className="text-muted mt-2">{board.prompt}</p>}
          <p className="text-xs text-muted mt-3 font-mono">Code: {board.code}</p>
        </header>

        {board.status !== "open" && (
          <div className="rounded-lg bg-amber-100 border border-amber-300 p-3 text-center text-sm text-amber-900">
            Board này đã đóng. Bạn chỉ có thể xem note hiện có.
          </div>
        )}

        {board.status === "open" && (
          <div className="rounded-2xl bg-white border border-token p-4 space-y-3 shadow-sm">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên hiển thị"
              maxLength={40}
              className="input w-full"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Note của bạn..."
              maxLength={500}
              rows={3}
              className="input w-full"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted">{content.length}/500</p>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                {submitting ? "Đang gửi..." : "Gửi note"}
              </button>
            </div>
            {info && <p className="text-sm text-muted">{info}</p>}
          </div>
        )}

        <div>
          <p className="text-sm text-muted mb-2">{board.notes.length} note</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {board.notes.length === 0 && (
              <p className="text-sm text-muted col-span-full text-center py-8">
                Chưa có note nào — hãy là người đầu tiên!
              </p>
            )}
            {board.notes.map((n) => (
              <div
                key={n.id}
                className="rounded-xl p-4 shadow-sm"
                style={{ backgroundColor: n.color || "#FEF3C7" }}
              >
                <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                  {n.content}
                </p>
                <p className="text-xs text-gray-600 mt-2 font-medium">— {n.authorName}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
