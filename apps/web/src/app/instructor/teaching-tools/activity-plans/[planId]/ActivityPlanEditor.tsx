"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Shuffle,
  BarChart3,
  Cloud,
  Users,
  Clock,
  PenTool,
  Plus,
  Pencil,
  Trash2,
  Share2,
  Globe,
  Link2,
  X,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { copyText } from "@/lib/clipboard";
import { TOOL_TYPE_LABELS, type PlanTemplateItem } from "../templates";

type ToolType = PlanTemplateItem["toolType"];

interface PlanItem {
  id: string;
  toolType: ToolType;
  label: string;
  config: Record<string, unknown> | null;
  orderIndex: number;
}

interface Plan {
  id: string;
  title: string;
  items: PlanItem[];
  isOwner: boolean;
  isPublic: boolean;
  shareCode: string | null;
}

const TOOL_ICONS: Record<ToolType, typeof Shuffle> = {
  random_picker: Shuffle,
  quick_poll: BarChart3,
  word_cloud: Cloud,
  grouping_tool: Users,
  countdown_timer: Clock,
  whiteboard: PenTool,
};

const TOOL_ORDER: ToolType[] = [
  "random_picker",
  "quick_poll",
  "word_cloud",
  "grouping_tool",
  "countdown_timer",
  "whiteboard",
];

export default function ActivityPlanEditor({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [pickingTool, setPickingTool] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanItem | "new-random_picker" | "new-quick_poll" | "new-word_cloud" | "new-grouping_tool" | "new-countdown_timer" | "new-whiteboard" | null>(null);

  const load = async () => {
    const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}`));
    if (!res.ok) { toast.error("Không tải được kịch bản"); return; }
    const data = await res.json();
    setPlan(data);
    setTitleDraft(data.title);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  // Đồng biên soạn (co-share) — ai đổi gì thì mọi người đang mở đều nhận tín
  // hiệu và refetch nguyên plan (không merge từng field, xem
  // activity-plans.ts core-lms). Áp dụng cho cả chủ sở hữu lẫn collaborator.
  useEffect(() => {
    const es = new EventSource(apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}/stream`));
    es.onmessage = () => load();
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const handleSaveTitle = async () => {
    if (!plan || !titleDraft.trim() || titleDraft === plan.title) return;
    setIsSavingTitle(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });
      if (!res.ok) { toast.error("Lưu tên thất bại"); return; }
      setPlan((prev) => (prev ? { ...prev, title: titleDraft.trim() } : prev));
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsSavingTitle(false);
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!plan) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = plan.items.findIndex((i) => i.id === active.id);
    const newIdx = plan.items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const nextItems = arrayMove(plan.items, oldIdx, newIdx);
    setPlan({ ...plan, items: nextItems });
    const res = await fetch(
      apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}/items/reorder`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedItemIds: nextItems.map((i) => i.id) }),
      }
    );
    if (!res.ok) {
      toast.error("Sắp xếp thất bại — đã rollback");
      load();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Xoá event này?")) return;
    const res = await fetch(
      apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}/items/${itemId}`),
      { method: "DELETE" }
    );
    if (!res.ok) { toast.error("Xoá thất bại"); return; }
    setPlan((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev);
  };

  if (!plan) return <p className="text-sm text-muted">Đang tải...</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card">
        <label className="mb-1.5 block text-sm font-medium">Tên kịch bản</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            disabled={isSavingTitle}
            className="input flex-1"
          />
        </div>
        {!plan.isOwner && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <Users size={12} /> Bạn đang đồng biên soạn kịch bản này
          </p>
        )}
      </div>

      {plan.isOwner && <SharingPanel plan={plan} onChange={(patch) => setPlan((prev) => (prev ? { ...prev, ...patch } : prev))} />}

      <div className="space-y-3">
        {plan.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
            Chưa có event nào — bấm "+ Thêm event" bên dưới.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={plan.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
                {plan.items.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => setEditingItem(item)}
                    onDelete={() => handleDeleteItem(item.id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {!pickingTool ? (
          <button
            onClick={() => setPickingTool(true)}
            className="btn-secondary flex w-full items-center justify-center gap-2"
          >
            <Plus size={16} /> Thêm event
          </button>
        ) : (
          <div className="rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-4">
            <p className="mb-3 text-sm font-semibold">Chọn loại công cụ</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TOOL_ORDER.map((toolType) => {
                const Icon = TOOL_ICONS[toolType];
                return (
                  <button
                    key={toolType}
                    onClick={() => {
                      setPickingTool(false);
                      setEditingItem(`new-${toolType}` as any);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2.5 text-sm font-medium transition hover:border-brand-400"
                  >
                    <Icon size={16} /> {TOOL_TYPE_LABELS[toolType]}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPickingTool(false)}
              className="btn-text mt-3 text-xs"
            >
              Huỷ
            </button>
          </div>
        )}
      </div>

      {editingItem && (
        <ItemFormModal
          planId={planId}
          editingItem={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={(item, isNew) => {
            setPlan((prev) => {
              if (!prev) return prev;
              if (isNew) return { ...prev, items: [...prev.items, item] };
              return { ...prev, items: prev.items.map((i) => (i.id === item.id ? item : i)) };
            });
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}

// ── Chia sẻ (P1) — chỉ chủ sở hữu thấy được panel này ───────────────────────

function SharingPanel({
  plan,
  onChange,
}: {
  plan: Plan;
  onChange: (patch: Partial<Plan>) => void;
}) {
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [collaborators, setCollaborators] = useState<Array<{ userId: string; displayName: string }> | null>(null);

  const shareUrl = plan.shareCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/instructor/teaching-tools/activity-plans/shared/${plan.shareCode}`
    : null;

  const handleTogglePublic = async () => {
    setIsTogglingPublic(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !plan.isPublic }),
      });
      if (!res.ok) { toast.error("Thao tác thất bại"); return; }
      const updated = await res.json();
      onChange({ isPublic: updated.isPublic });
      toast.success(updated.isPublic ? "Đã đưa vào chợ kịch bản" : "Đã gỡ khỏi chợ kịch bản");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/share-code`), {
        method: "POST",
      });
      if (!res.ok) { toast.error("Tạo link thất bại"); return; }
      const data = await res.json();
      onChange({ shareCode: data.shareCode });
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!confirm("Thu hồi link chia sẻ? Link cũ sẽ ngừng hoạt động.")) return;
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/share-code`), {
        method: "DELETE",
      });
      if (!res.ok) { toast.error("Thu hồi thất bại"); return; }
      onChange({ shareCode: null });
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    const ok = await copyText(shareUrl);
    if (ok) toast.success("Đã copy link!");
    else toast.error("Không sao chép được — bạn chọn link rồi copy tay giúp");
  };

  const toggleCollaborators = async () => {
    setShowCollaborators((v) => !v);
    if (collaborators !== null) return;
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/collaborators`));
      if (res.ok) setCollaborators((await res.json()).collaborators);
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    const res = await fetch(
      apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/collaborators/${userId}`),
      { method: "DELETE" }
    );
    if (!res.ok) { toast.error("Xoá thất bại"); return; }
    setCollaborators((prev) => prev?.filter((c) => c.userId !== userId) ?? null);
  };

  return (
    <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Share2 size={16} className="text-muted" />
        <h3 className="text-sm font-bold">Chia sẻ</h3>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <Globe size={14} className="text-muted" /> Công khai lên chợ kịch bản
          </span>
          <input
            type="checkbox"
            checked={plan.isPublic}
            disabled={isTogglingPublic}
            onChange={handleTogglePublic}
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm">
            <Link2 size={14} className="text-muted" /> Link riêng (xem + sao chép, hoặc tham gia đồng biên soạn)
          </p>
          {plan.shareCode && shareUrl ? (
            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="input flex-1 text-xs" onFocus={(e) => e.target.select()} />
              <button onClick={handleCopyLink} className="btn-secondary btn-sm shrink-0">Copy</button>
              <button onClick={handleRevokeLink} className="btn-icon btn-danger shrink-0" title="Thu hồi link">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button onClick={handleGenerateLink} disabled={isGeneratingLink} className="btn-secondary btn-sm">
              {isGeneratingLink ? "Đang tạo..." : "Tạo link chia sẻ"}
            </button>
          )}
        </div>

        <div>
          <button onClick={toggleCollaborators} className="btn-text text-xs">
            {showCollaborators ? "Ẩn" : "Xem"} danh sách đồng biên soạn
          </button>
          {showCollaborators && (
            <ul className="mt-2 space-y-1">
              {collaborators === null ? (
                <li className="text-xs text-muted">Đang tải...</li>
              ) : collaborators.length === 0 ? (
                <li className="text-xs text-muted">Chưa có ai tham gia đồng biên soạn.</li>
              ) : (
                collaborators.map((c) => (
                  <li key={c.userId} className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.displayName}</span>
                    <button onClick={() => handleRemoveCollaborator(c.userId)} className="btn-icon btn-danger btn-sm" title="Gỡ khỏi kịch bản">
                      <X size={12} />
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: PlanItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = TOOL_ICONS[item.toolType];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 shadow-card"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md border border-token text-xs text-faint hover:bg-[rgb(var(--surface-muted))] active:cursor-grabbing"
        aria-label="Kéo để sắp xếp"
        type="button"
      >
        ≡
      </button>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.label}</p>
        <p className="text-xs text-muted">{TOOL_TYPE_LABELS[item.toolType]}</p>
      </div>
      <button onClick={onEdit} className="btn-icon shrink-0" title="Sửa">
        <Pencil size={15} />
      </button>
      <button onClick={onDelete} className="btn-icon btn-danger shrink-0" title="Xoá">
        <Trash2 size={15} />
      </button>
    </li>
  );
}

// ── Item create/edit form ──────────────────────────────────────────────────

function ItemFormModal({
  planId,
  editingItem,
  onClose,
  onSaved,
}: {
  planId: string;
  editingItem: PlanItem | string;
  onClose: () => void;
  onSaved: (item: PlanItem, isNew: boolean) => void;
}) {
  const isNew = typeof editingItem === "string";
  const toolType: ToolType = isNew
    ? (editingItem.replace("new-", "") as ToolType)
    : editingItem.toolType;
  const existing = isNew ? null : editingItem;
  const config = (existing?.config ?? {}) as Record<string, any>;

  const [label, setLabel] = useState(existing?.label ?? "");
  const [question, setQuestion] = useState(config.question ?? "");
  const [options, setOptions] = useState<string[]>(config.options ?? ["", ""]);
  const [prompt, setPrompt] = useState(config.prompt ?? "");
  const [groupMode, setGroupMode] = useState<"groupSize" | "numGroups">(config.mode ?? "groupSize");
  const [groupSize, setGroupSize] = useState<number>(config.groupSize ?? 3);
  const [numGroups, setNumGroups] = useState<number>(config.numGroups ?? 3);
  const [minutes, setMinutes] = useState<number>(config.minutes ?? 10);
  // Hướng dẫn hiển thị cho học viên lúc chạy — áp dụng cho MỌI loại tool
  // (không riêng countdown), xem ActivityPlanRunner.tsx.
  const [notes, setNotes] = useState<string>(config.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const buildConfig = (): Record<string, unknown> | undefined => {
    const notesPart = notes.trim() ? { notes: notes.trim() } : {};
    switch (toolType) {
      case "quick_poll": {
        const filled = options.map((o) => o.trim()).filter(Boolean);
        return { question: question.trim(), options: filled, ...notesPart };
      }
      case "word_cloud":
        return { prompt: prompt.trim(), ...notesPart };
      case "grouping_tool":
        return {
          ...(groupMode === "groupSize" ? { mode: groupMode, groupSize } : { mode: groupMode, numGroups }),
          ...notesPart,
        };
      case "countdown_timer":
        return { minutes, ...notesPart };
      default:
        return Object.keys(notesPart).length ? notesPart : undefined;
    }
  };

  const validate = (): string | null => {
    if (!label.trim()) return "Nhập tên gợi nhớ cho event";
    if (toolType === "quick_poll") {
      if (!question.trim()) return "Nhập câu hỏi";
      if (options.map((o) => o.trim()).filter(Boolean).length < 2) return "Cần ít nhất 2 lựa chọn";
    }
    if (toolType === "word_cloud" && !prompt.trim()) return "Nhập câu hỏi/prompt";
    if (toolType === "countdown_timer" && minutes < 1) return "Số phút phải ≥ 1";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setIsSaving(true);
    try {
      const body = { label: label.trim(), config: buildConfig() };
      const url = isNew
        ? apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}/items`)
        : apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}/items/${existing!.id}`);
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? { toolType, ...body } : body),
      });
      if (!res.ok) { toast.error("Lưu thất bại"); return; }
      const saved = await res.json();
      onSaved(saved, isNew);
      toast.success("Đã lưu");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-bold">
          {isNew ? `Thêm event — ${TOOL_TYPE_LABELS[toolType]}` : `Sửa event — ${TOOL_TYPE_LABELS[toolType]}`}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tên gợi nhớ</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Vd: Khởi động"
              className="input w-full"
            />
          </div>

          {toolType === "quick_poll" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Câu hỏi</label>
                <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Lựa chọn</label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...options];
                          next[idx] = e.target.value;
                          setOptions(next);
                        }}
                        placeholder={`Lựa chọn ${idx + 1}`}
                        className="input flex-1"
                      />
                      {options.length > 2 && (
                        <button onClick={() => setOptions(options.filter((_, i) => i !== idx))} className="btn-icon btn-danger">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setOptions([...options, ""])} className="btn-text mt-2 text-sm">+ Thêm lựa chọn</button>
              </div>
            </>
          )}

          {toolType === "word_cloud" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Câu hỏi / Prompt</label>
              <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="input w-full" />
            </div>
          )}

          {toolType === "grouping_tool" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Cách chia</label>
              <div className="mb-2 inline-flex rounded-lg border border-token p-0.5">
                <button
                  type="button"
                  onClick={() => setGroupMode("groupSize")}
                  className={`rounded-md px-3 py-1.5 text-sm ${groupMode === "groupSize" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30" : ""}`}
                >
                  Số người/nhóm
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode("numGroups")}
                  className={`rounded-md px-3 py-1.5 text-sm ${groupMode === "numGroups" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30" : ""}`}
                >
                  Tổng số nhóm
                </button>
              </div>
              <input
                type="number"
                min={1}
                value={groupMode === "groupSize" ? groupSize : numGroups}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  groupMode === "groupSize" ? setGroupSize(v) : setNumGroups(v);
                }}
                className="input w-24"
              />
            </div>
          )}

          {toolType === "countdown_timer" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Số phút</label>
              <input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                className="input w-24"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Hướng dẫn cho học viên <span className="font-normal text-muted">(tuỳ chọn, hiện cùng lúc chạy)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Vd: Mỗi bạn viết 1 câu trả lời ra giấy trong thời gian này..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Huỷ</button>
          <button onClick={handleSave} disabled={isSaving} className="btn-primary">
            {isSaving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
