"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Presentation, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/datetime";
import EmptyState from "@/components/ui/EmptyState";

interface DeckSummary {
  id: string;
  title: string;
  updatedAt: string;
  _count: { slides: number };
}

export default function LiveDeckList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const newTitleInputRef = useRef<HTMLInputElement>(null);

  // Link cũ "?new=1" (menu trái trước đây) vẫn mở luôn form tạo.
  useEffect(() => {
    if (searchParams.get("new") === "1") setFormOpen(true);
  }, [searchParams]);

  // Mở form: focus vào ô tên; Esc để đóng.
  useEffect(() => {
    if (!formOpen) return;
    newTitleInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCreating) setFormOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [formOpen, isCreating]);

  const load = async () => {
    try {
      const res = await fetch(apiUrl("/api/instructor/limio-live/decks"));
      if (!res.ok) { toast.error("Không tải được danh sách bài giảng"); return; }
      const data = await res.json();
      setDecks(data.decks);
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTitle.trim()) { toast.error("Nhập tên bài giảng"); return; }
    setIsCreating(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/limio-live/decks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) { toast.error("Tạo bài giảng thất bại"); return; }
      const deck = await res.json();
      router.push(`/instructor/limio-live/${deck.id}`);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (deckId: string) => {
    if (!confirm("Xoá bài giảng này? Không thể hoàn tác.")) return;
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`), { method: "DELETE" });
    if (!res.ok) { toast.error("Xoá thất bại"); return; }
    setDecks((prev) => prev?.filter((d) => d.id !== deckId) ?? null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setNewTitle("");
            setFormOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Tạo bài giảng
        </button>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isCreating) setFormOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-deck-title"
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-2xl"
          >
            <h2 id="new-deck-title" className="text-lg font-semibold">
              Tạo bài giảng
            </h2>
            <label className="mt-4 block text-sm font-medium" htmlFor="new-deck-input">
              Tên bài giảng
            </label>
            <input
              id="new-deck-input"
              ref={newTitleInputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Vd: Bài 3 — Quang hợp"
              maxLength={200}
              className="input mt-1.5"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={isCreating}
                className="btn-ghost"
              >
                Hủy
              </button>
              <button type="submit" disabled={isCreating} className="btn-primary">
                {isCreating ? "Đang tạo..." : "Tạo bài giảng"}
              </button>
            </div>
          </form>
        </div>
      )}

      {decks === null ? (
        <p className="text-sm text-muted">Đang tải...</p>
      ) : decks.length === 0 ? (
        <EmptyState
          icon={<Presentation size={40} className="mx-auto" />}
          title="Chưa có bài giảng nào"
          description="Bấm “Tạo bài giảng” để bắt đầu."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <li
              key={deck.id}
              className="group relative rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card transition hover:border-brand-400"
            >
              <a href={`/instructor/limio-live/${deck.id}`} className="block">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  <Presentation size={18} />
                </div>
                <p className="truncate pr-6 text-sm font-semibold">{deck.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {deck._count.slides} slide · Sửa lần cuối {formatDateTime(deck.updatedAt)}
                </p>
              </a>
              <button
                onClick={() => handleDelete(deck.id)}
                className="btn-icon btn-danger absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100"
                title="Xoá"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
