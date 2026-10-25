"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, LogOut, UserPlus, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

interface Person {
  userId: string;
  displayName: string;
  email: string | null;
}

interface People {
  owner: Person;
  collaborators: Array<Person & { addedAt: string }>;
  role: "owner" | "collaborator";
  selfId: string;
}

const ERRORS: Record<string, string> = {
  invalid_email: "Email chưa đúng dạng.",
  user_not_found: "Chưa có tài khoản nào dùng email này. Người đó cần đăng ký Limio trước.",
  no_limio_live_access: "Tài khoản này chưa được dùng Limio-Live.",
  already_owner: "Người này đã là chủ của bài giảng.",
  forbidden: "Bạn không có quyền làm việc này.",
  not_found: "Không tìm thấy bài giảng.",
};

/**
 * Đồng giảng viên của bài giảng (docs/tieu-chi/dong-giang-vien-bai-giang.md, AC1–AC2): chủ bài thêm bằng email (tài khoản đã có) và gỡ;
 * đồng giảng viên chỉ xem danh sách và tự rời được. Đồng giảng viên soạn, chỉnh bằng AI và chiếu như chủ; không xoá, chia sẻ link, đổi
 * nhóm hay thêm người.
 */
export default function DeckCollaboratorsDialog({ deckId, onClose, onLeft }: { deckId: string; onClose: () => void; onLeft?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [people, setPeople] = useState<People | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const load = useCallback(async () => {
    const r = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/collaborators`), { cache: "no-store" });
    if (r.ok) setPeople((await r.json()) as People);
    else setError(ERRORS[((await r.json().catch(() => ({}))) as { error?: string }).error ?? ""] ?? "Không tải được danh sách.");
  }, [deckId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/collaborators`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; added?: boolean; person?: Person };
      if (!r.ok) setError(ERRORS[j.error ?? ""] ?? "Chưa thêm được. Thử lại sau.");
      else {
        setEmail("");
        toast.success(j.added ? `Đã thêm ${j.person?.displayName ?? "đồng giảng viên"}` : "Người này đã là đồng giảng viên");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Person, self: boolean) {
    if (!confirm(self ? "Rời khỏi bài giảng này? Thầy/cô sẽ không soạn hay chiếu được nữa cho tới khi chủ bài thêm lại." : `Gỡ ${p.displayName} khỏi bài giảng?`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/collaborators/${p.userId}`), { method: "DELETE" });
      if (!r.ok) {
        setError("Chưa gỡ được. Thử lại sau.");
        return;
      }
      if (self) {
        toast.success("Đã rời bài giảng");
        onLeft?.();
        return;
      }
      toast.success(`Đã gỡ ${p.displayName}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const isOwner = people?.role === "owner";
  const row = "flex items-center gap-3 rounded-lg px-2 py-2";

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby="collab-dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(560px,94vw)] max-w-none rounded-2xl border border-token bg-[rgb(var(--surface))] p-0 text-[rgb(var(--text))] shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center gap-3 border-b border-token px-5 py-3">
        <h2 id="collab-dlg-title" className="text-h4 flex-1">
          Đồng giảng viên
        </h2>
        <button onClick={() => ref.current?.close()} className="rounded-lg p-1.5 text-muted hover:bg-[rgb(var(--surface-muted))]" aria-label="Đóng">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        <p className="text-body">
          Đồng giảng viên cùng soạn slide, nhờ AI chỉnh và trình chiếu bài giảng này. Họ không xoá bài, không tạo link chia sẻ, không đổi
          nhóm và không thêm người khác. Mỗi người chỉ xem kết quả các lượt chiếu do chính mình điều hành.
        </p>

        {!people ? (
          <p className="text-sm text-muted">{error ?? "Đang tải…"}</p>
        ) : (
          <>
            <ul className="divide-y divide-[rgb(var(--border))]">
              <li className={row}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{people.owner.displayName}</span>
                  {people.owner.email && <span className="block truncate text-caption text-muted">{people.owner.email}</span>}
                </span>
                <span className="chip-brand shrink-0">Chủ bài giảng</span>
              </li>
              {people.collaborators.map((c) => (
                <li key={c.userId} className={row}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.displayName}</span>
                    {c.email && <span className="block truncate text-caption text-muted">{c.email}</span>}
                  </span>
                  <span className="chip shrink-0">Đồng giảng viên</span>
                  {isOwner && (
                    <button type="button" onClick={() => void remove(c, false)} disabled={busy} className="rounded-lg px-2.5 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20">
                      Gỡ
                    </button>
                  )}
                </li>
              ))}
              {people.collaborators.length === 0 && <li className="px-2 py-2 text-sm text-muted">Chưa có đồng giảng viên nào.</li>}
            </ul>

            {isOwner ? (
              <form onSubmit={(e) => void add(e)} className="space-y-2">
                <label htmlFor="collab-email" className="block text-sm font-medium">
                  Thêm bằng email
                </label>
                <div className="flex gap-2">
                  <input
                    id="collab-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@truong.edu.vn"
                    autoComplete="off"
                    className="input min-w-0 flex-1"
                  />
                  <button type="submit" className="btn-primary flex shrink-0 items-center gap-1.5" disabled={busy || !email.trim()}>
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                    Thêm
                  </button>
                </div>
                <p className="text-caption text-muted">Chỉ thêm được người đã có tài khoản Limio và được dùng Limio-Live; hệ thống không gửi thư mời.</p>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => void remove(people.collaborators.find((c) => c.userId === people.selfId)!, true)}
                disabled={busy}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <LogOut size={14} aria-hidden="true" />
                Rời bài giảng này
              </button>
            )}
          </>
        )}

        {error && people && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
