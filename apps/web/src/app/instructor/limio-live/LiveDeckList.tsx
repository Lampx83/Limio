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
  const newTitleInputRef = useRef<HTMLInputElement>(null);

  // Nút "Tạo bài giảng mới" ở menu trái trỏ vào đây kèm ?new=1 — đưa thẳng
  // focus vào ô nhập tên thay vì bắt GV tự tìm khung tạo trên trang danh sách.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      newTitleInputRef.current?.focus();
    }
  }, [searchParams]);

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

  const handleCreate = async () => {
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
      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card">
        <label className="mb-1.5 block text-sm font-medium">Tạo bài giảng mới</label>
        <div className="flex gap-2">
          <input
            ref={newTitleInputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Vd: Bài 3 — Quang hợp"
            className="input flex-1"
          />
          <button onClick={handleCreate} disabled={isCreating} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {isCreating ? "Đang tạo..." : "Tạo"}
          </button>
        </div>
      </div>

      {decks === null ? (
        <p className="text-sm text-muted">Đang tải...</p>
      ) : decks.length === 0 ? (
        <EmptyState
          icon={<Presentation size={40} className="mx-auto" />}
          title="Chưa có bài giảng nào"
          description="Tạo bài giảng đầu tiên ở khung phía trên."
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
