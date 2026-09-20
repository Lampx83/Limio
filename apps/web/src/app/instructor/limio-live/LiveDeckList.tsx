"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Copy,
  FolderInput,
  FolderPlus,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Presentation,
  Share2,
  Trash2,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/datetime";
import EmptyState from "@/components/ui/EmptyState";

interface DeckSummary {
  id: string;
  title: string;
  updatedAt: string;
  groupId: string | null;
  _count: { slides: number };
}

type GroupKind = "course" | "event" | "other";

interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  courseId: string | null;
  course: { id: string; title: string } | null;
  _count: { decks: number };
}

interface CourseOption {
  id: string;
  title: string;
}

const KIND_META: Record<GroupKind, { label: string; dot: string; tag: string; icon: string }> = {
  course: {
    label: "Khoá học",
    dot: "bg-lime-600",
    tag: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
    icon: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
  },
  event: {
    label: "Sự kiện",
    dot: "bg-amber-500",
    tag: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  other: {
    label: "Khác",
    dot: "bg-slate-400",
    tag: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

const NO_GROUP = "__none";

export default function LiveDeckList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const [view, setView] = useState<"group" | "flat">("group");
  const [filter, setFilter] = useState<string>(""); // "" = mọi nhóm
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Hộp thoại tạo bài giảng
  const [newTitle, setNewTitle] = useState("");
  const [newGroupId, setNewGroupId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const newTitleInputRef = useRef<HTMLInputElement>(null);

  // Hộp thoại nhóm (tạo mới / sửa)
  const [groupDialog, setGroupDialog] = useState<{ mode: "create" | "edit"; group?: Group; moveDeckId?: string } | null>(null);

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);

  // Link cũ "?new=1" vẫn mở luôn form tạo.
  useEffect(() => {
    if (searchParams.get("new") === "1") setFormOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!formOpen) return;
    newTitleInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCreating) setFormOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [formOpen, isCreating]);

  const loadDecks = async () => {
    try {
      const res = await fetch(apiUrl("/api/instructor/limio-live/decks"));
      if (!res.ok) { toast.error("Không tải được danh sách bài giảng"); return; }
      const data = await res.json();
      setDecks(data.decks);
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const loadGroups = async () => {
    try {
      const res = await fetch(apiUrl("/api/instructor/limio-live/groups"));
      if (!res.ok) return;
      const data = await res.json();
      setGroups(data.groups);
      setCourses(data.courses);
    } catch {
      /* nhóm là phần bổ trợ — lỗi mạng đã được báo ở danh sách bài giảng */
    }
  };

  const reloadAll = async () => {
    await Promise.all([loadDecks(), loadGroups()]);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  // Đóng menu "Chuyển vào nhóm" khi bấm ra ngoài.
  useEffect(() => {
    if (!moveMenuFor) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-move-menu]")) setMoveMenuFor(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moveMenuFor]);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTitle.trim()) { toast.error("Nhập tên bài giảng"); return; }
    setIsCreating(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/limio-live/decks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), groupId: newGroupId || null }),
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

  const openCreate = () => {
    setNewTitle("");
    // Đang xem một nhóm cụ thể thì bài mới mặc định vào nhóm đó.
    setNewGroupId(filter && filter !== NO_GROUP ? filter : "");
    setFormOpen(true);
  };

  const handleDuplicate = async (deckId: string) => {
    if (duplicatingId) return;
    setDuplicatingId(deckId);
    try {
      const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/duplicate`), { method: "POST" });
      if (!res.ok) { toast.error("Sao chép thất bại"); return; }
      toast.success("Đã sao chép bài giảng");
      await reloadAll();
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (deckId: string) => {
    if (!confirm("Xoá bài giảng này? Không thể hoàn tác.")) return;
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`), { method: "DELETE" });
    if (!res.ok) { toast.error("Xoá thất bại"); return; }
    await reloadAll();
  };

  const moveDeck = async (deckId: string, groupId: string | null) => {
    setMoveMenuFor(null);
    const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    if (!res.ok) { toast.error("Không chuyển được bài giảng"); return; }
    toast.success(groupId ? `Đã chuyển vào “${groupById.get(groupId)?.name ?? "nhóm"}”` : "Đã bỏ khỏi nhóm");
    await reloadAll();
  };

  const deleteGroup = async (g: Group) => {
    if (!confirm(`Xoá nhóm “${g.name}”? Các bài giảng trong nhóm vẫn được giữ, chỉ mất nhóm.`)) return;
    const res = await fetch(apiUrl(`/api/instructor/limio-live/groups/${g.id}`), { method: "DELETE" });
    if (!res.ok) { toast.error("Xoá nhóm thất bại"); return; }
    if (filter === g.id) setFilter("");
    await reloadAll();
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Chia bài giảng theo nhóm (giữ thứ tự cập nhật mới nhất trước của API).
  const sections = useMemo(() => {
    if (!decks) return [];
    const byGroup = new Map<string, DeckSummary[]>();
    const none: DeckSummary[] = [];
    for (const d of decks) {
      if (d.groupId && groupById.has(d.groupId)) {
        const arr = byGroup.get(d.groupId) ?? [];
        arr.push(d);
        byGroup.set(d.groupId, arr);
      } else none.push(d);
    }
    const list: Array<{ key: string; group: Group | null; decks: DeckSummary[] }> = groups.map((g) => ({
      key: g.id,
      group: g,
      decks: byGroup.get(g.id) ?? [],
    }));
    if (none.length > 0 || groups.length === 0) list.push({ key: NO_GROUP, group: null, decks: none });
    return list;
  }, [decks, groups, groupById]);

  const visibleSections = filter ? sections.filter((s) => s.key === filter) : sections;
  const visibleFlat = (decks ?? []).filter((d) =>
    !filter ? true : filter === NO_GROUP ? !d.groupId || !groupById.has(d.groupId) : d.groupId === filter,
  );
  const hasGroups = groups.length > 0;

  const renderCard = (deck: DeckSummary, showGroupChip: boolean) => {
    const g = deck.groupId ? groupById.get(deck.groupId) : undefined;
    const meta = g ? KIND_META[g.kind] : KIND_META.other;
    return (
      <li
        key={deck.id}
        className="group relative rounded-xl border border-token bg-[rgb(var(--surface))] p-3 shadow-card transition hover:border-brand-400"
      >
        <a href={`/instructor/limio-live/${deck.id}`} className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${g ? meta.icon : "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"}`}>
            <Presentation size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-snug" title={deck.title}>
              {deck.title}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {deck._count.slides} slide · {formatDate(deck.updatedAt)}
            </span>
            {showGroupChip && g && (
              <span className={`mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tag}`}>
                <span className="truncate">{g.name}</span>
              </span>
            )}
          </span>
        </a>
        <div className="mt-2 flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() =>
              toast.info("Chia sẻ bài giảng sắp ra mắt", {
                description: "Bạn sẽ chia sẻ được cho đồng nghiệp và đăng lên chợ bài giảng.",
              })
            }
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
            title="Chia sẻ (sắp ra mắt)"
            aria-label="Chia sẻ bài giảng"
          >
            <Share2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleDuplicate(deck.id)}
            disabled={duplicatingId !== null}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] disabled:opacity-50"
            title={duplicatingId === deck.id ? "Đang sao chép…" : "Sao chép bài giảng này (kèm toàn bộ slide)"}
            aria-label="Sao chép bài giảng"
          >
            <Copy size={14} />
          </button>
          <div className="relative" data-move-menu>
            <button
              type="button"
              onClick={() => setMoveMenuFor((cur) => (cur === deck.id ? null : deck.id))}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
              title="Chuyển vào nhóm"
              aria-label="Chuyển vào nhóm"
              aria-haspopup="menu"
              aria-expanded={moveMenuFor === deck.id}
            >
              <FolderInput size={14} />
            </button>
            {moveMenuFor === deck.id && (
              <div
                role="menu"
                className="absolute bottom-full right-0 z-30 mb-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-token bg-[rgb(var(--surface))] py-1 shadow-2xl"
              >
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Chuyển vào nhóm
                </p>
                {groups.map((gr) => (
                  <button
                    key={gr.id}
                    type="button"
                    role="menuitem"
                    onClick={() => moveDeck(deck.id, gr.id)}
                    disabled={deck.groupId === gr.id}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_META[gr.kind].dot}`} />
                    <span className="min-w-0 flex-1 truncate">{gr.name}</span>
                    {deck.groupId === gr.id && <span className="text-xs text-faint">hiện tại</span>}
                  </button>
                ))}
                {deck.groupId && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => moveDeck(deck.id, null)}
                    className="flex w-full items-center gap-2 border-t border-token px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--surface-muted))]"
                  >
                    Bỏ khỏi nhóm
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoveMenuFor(null);
                    setGroupDialog({ mode: "create", moveDeckId: deck.id });
                  }}
                  className="flex w-full items-center gap-2 border-t border-token px-3 py-1.5 text-left text-sm text-brand-700 hover:bg-[rgb(var(--surface-muted))]"
                >
                  <Plus size={14} /> Nhóm mới…
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleDelete(deck.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600"
            title="Xoá"
            aria-label="Xoá bài giảng"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </li>
    );
  };

  const gridCls = "grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {hasGroups && (
          <>
            <div role="group" aria-label="Kiểu xem" className="inline-flex rounded-lg bg-[rgb(var(--surface-muted))] p-0.5">
              {(
                [
                  { id: "group", label: "Theo nhóm" },
                  { id: "flat", label: "Tất cả" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-pressed={view === v.id}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    view === v.id ? "bg-[rgb(var(--surface))] text-brand-700 shadow-sm" : "text-muted hover:text-[rgb(var(--text))]"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Lọc theo nhóm"
              className="select !h-9 min-w-[12rem] !py-0 text-sm font-medium"
            >
              <option value="">Mọi nhóm</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value={NO_GROUP}>Chưa phân nhóm</option>
            </select>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGroupDialog({ mode: "create" })}
            className="btn-secondary flex items-center gap-2"
          >
            <FolderPlus size={16} /> Nhóm mới
          </button>
          <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Tạo bài giảng
          </button>
        </div>
      </div>

      {formOpen && (
        <Modal onClose={() => !isCreating && setFormOpen(false)}>
          <form onSubmit={handleCreate} role="dialog" aria-modal="true" aria-labelledby="new-deck-title">
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
              maxLength={100}
              className="input mt-1.5"
            />
            {hasGroups && (
              <>
                <label className="mt-4 block text-sm font-medium" htmlFor="new-deck-group">
                  Nhóm <span className="font-normal text-muted">(tuỳ chọn)</span>
                </label>
                <select
                  id="new-deck-group"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  className="select mt-1.5"
                >
                  <option value="">Chưa phân nhóm</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} disabled={isCreating} className="btn-ghost">
                Hủy
              </button>
              <button type="submit" disabled={isCreating} className="btn-primary">
                {isCreating ? "Đang tạo..." : "Tạo bài giảng"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {groupDialog && (
        <GroupDialog
          mode={groupDialog.mode}
          group={groupDialog.group}
          courses={courses}
          onClose={() => setGroupDialog(null)}
          onSaved={async (saved) => {
            const moveId = groupDialog.moveDeckId;
            setGroupDialog(null);
            if (moveId) await moveDeck(moveId, saved.id);
            else await reloadAll();
          }}
        />
      )}

      {decks === null ? (
        <p className="text-sm text-muted">Đang tải...</p>
      ) : decks.length === 0 && groups.length === 0 ? (
        <EmptyState
          icon={<Presentation size={40} className="mx-auto" />}
          title="Chưa có bài giảng nào"
          description="Bấm “Tạo bài giảng” để bắt đầu."
        />
      ) : view === "flat" || !hasGroups ? (
        visibleFlat.length === 0 ? (
          <p className="text-sm text-muted">Không có bài giảng nào trong bộ lọc này.</p>
        ) : (
          <ul className={gridCls}>{visibleFlat.map((d) => renderCard(d, hasGroups))}</ul>
        )
      ) : (
        <div className="space-y-5">
          {visibleSections.map((sec) => {
            const g = sec.group;
            const meta = g ? KIND_META[g.kind] : KIND_META.other;
            const isClosed = collapsed.has(sec.key);
            return (
              <section key={sec.key}>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(sec.key)}
                    aria-expanded={!isClosed}
                    className="flex min-w-0 items-center gap-2 rounded-md text-left"
                  >
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-muted transition-transform ${isClosed ? "-rotate-90" : ""}`}
                      aria-hidden
                    />
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${meta.dot}`} aria-hidden />
                    <span className="truncate text-sm font-semibold">{g ? g.name : "Chưa phân nhóm"}</span>
                  </button>
                  {g && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tag}`}>{meta.label}</span>
                  )}
                  {g?.course && (
                    <a
                      href={`/instructor/courses/${g.course.id}`}
                      className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-full border border-token px-2 py-0.5 text-[11px] text-muted hover:border-brand-300 hover:text-brand-700"
                      title={`Liên kết với khoá: ${g.course.title}`}
                    >
                      <Link2 size={11} aria-hidden />
                      <span className="truncate">{g.course.title}</span>
                    </a>
                  )}
                  <span className="text-xs text-muted">{sec.decks.length} bài</span>
                  {g && (
                    <GroupMenu
                      onEdit={() => setGroupDialog({ mode: "edit", group: g })}
                      onDelete={() => deleteGroup(g)}
                    />
                  )}
                </div>
                {!isClosed &&
                  (sec.decks.length === 0 ? (
                    <p className="ml-6 mt-1 text-xs text-muted">
                      Nhóm chưa có bài giảng — dùng nút “Chuyển vào nhóm” trên thẻ bài giảng.
                    </p>
                  ) : (
                    <ul className={`mt-2 ${gridCls}`}>{sec.decks.map((d) => renderCard(d, false))}</ul>
                  ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function GroupMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-[rgb(var(--surface-muted))]"
        aria-label="Tuỳ chọn nhóm"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-token bg-[rgb(var(--surface))] py-1 shadow-2xl">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--surface-muted))]"
          >
            <Pencil size={14} /> Sửa nhóm
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-danger-600 hover:bg-danger-50"
          >
            <Trash2 size={14} /> Xoá nhóm
          </button>
        </div>
      )}
    </div>
  );
}

function GroupDialog({
  mode,
  group,
  courses,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  group?: Group;
  courses: CourseOption[];
  onClose: () => void;
  onSaved: (g: { id: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [kind, setKind] = useState<GroupKind>(group?.kind ?? "course");
  const [courseId, setCourseId] = useState<string>(group?.courseId ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Nhập tên nhóm"); return; }
    setBusy(true);
    try {
      const res = await fetch(
        apiUrl(mode === "edit" ? `/api/instructor/limio-live/groups/${group!.id}` : "/api/instructor/limio-live/groups"),
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            kind: kind === "course" && courseId ? "course" : kind,
            courseId: kind === "course" && courseId ? courseId : null,
          }),
        },
      );
      if (!res.ok) { toast.error("Lưu nhóm thất bại"); return; }
      const saved = await res.json();
      await onSaved(saved);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={() => !busy && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="group-dialog-title">
        <h2 id="group-dialog-title" className="text-lg font-semibold">
          {mode === "edit" ? "Sửa nhóm" : "Nhóm mới"}
        </h2>

        <span className="mt-4 block text-sm font-medium">Loại nhóm</span>
        <div role="radiogroup" aria-label="Loại nhóm" className="mt-1.5 inline-flex rounded-lg bg-[rgb(var(--surface-muted))] p-0.5">
          {(Object.keys(KIND_META) as GroupKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                kind === k ? "bg-[rgb(var(--surface))] text-brand-700 shadow-sm" : "text-muted hover:text-[rgb(var(--text))]"
              }`}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>

        {kind === "course" && (
          <>
            <label className="mt-4 block text-sm font-medium" htmlFor="group-course">
              Liên kết khoá học trong LMS <span className="font-normal text-muted">(tuỳ chọn)</span>
            </label>
            <select
              id="group-course"
              value={courseId}
              onChange={(e) => {
                const id = e.target.value;
                setCourseId(id);
                // Chọn khoá mà chưa đặt tên thì lấy luôn tên khoá.
                if (id && !name.trim()) setName(courses.find((c) => c.id === id)?.title ?? "");
              }}
              className="select mt-1.5"
            >
              <option value="">Không liên kết</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="mt-4 block text-sm font-medium" htmlFor="group-name">
          Tên nhóm
        </label>
        <input
          id="group-name"
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "event" ? "Vd: Hội thảo Toán 10/2026" : kind === "course" ? "Vd: Khoá Đại số 10" : "Vd: Tài liệu ôn tập"}
          maxLength={100}
          className="input mt-1.5"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Hủy
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Đang lưu..." : mode === "edit" ? "Lưu" : "Tạo nhóm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
