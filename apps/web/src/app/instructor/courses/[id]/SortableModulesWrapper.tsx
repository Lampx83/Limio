"use client";

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
import { useRouter } from "next/navigation";
import { useState, useEffect, ReactNode } from "react";

interface SortableItem {
  id: string;
  node: ReactNode;
}

/**
 * Generic vertical sortable wrapper. Posts new order to `reorderEndpoint`
 * when drag ends. Shows a tiny "≡" handle on the left of each item.
 */
export default function SortableModulesWrapper({
  items,
  reorderEndpoint,
  payloadKey = "orderedModuleIds",
}: {
  items: SortableItem[];
  reorderEndpoint: string;
  payloadKey?: string;
}) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState(items);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = localItems.findIndex((i) => i.id === active.id);
    const newIdx = localItems.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(localItems, oldIdx, newIdx);
    setLocalItems(next);
    setBusy(true);
    const res = await fetch(reorderEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [payloadKey]: next.map((i) => i.id) }),
    });
    setBusy(false);
    if (!res.ok) {
      // Revert + alert.
      setLocalItems(items);
      alert("Reorder thất bại — đã rollback");
      return;
    }
    router.refresh();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={localItems.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className={`space-y-4 ${busy ? "opacity-60" : ""}`}>
          {localItems.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {item.node}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-start gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-3 flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-token bg-[rgb(var(--surface))] text-xs text-faint transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] active:cursor-grabbing"
        aria-label="Kéo để sắp xếp"
        type="button"
      >
        ≡
      </button>
      {/* min-w-0 là bắt buộc, không phải trang trí: flex item mặc định
          min-width:auto nên nó không co xuống dưới bề rộng tự nhiên của nội
          dung. Thiếu nó thì một dòng chữ dài (nội dung richtext không xuống
          dòng) kéo cả hàng phình ra ngoài khung, đẩy nút sửa/xoá ra khỏi thẻ —
          dù mọi lớp bên trong đã có min-w-0 và truncate. */}
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
