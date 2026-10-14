"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kéo đổi độ rộng cột cho `<table style={{tableLayout:"fixed"}}>` — cùng cơ chế với bảng người dùng của admin.
 *
 * Một cột đầu là cột CO GIÃN (lấy phần còn lại, không có độ rộng riêng); các cột còn lại có độ rộng mặc định
 * theo % (co giãn theo màn hình) cho tới khi người dùng kéo, khi đó thành px và được nhớ trong localStorage.
 * Mỗi thanh kéo là một RANH GIỚI giữa hai cột liền kề: bên trái rộng ra bao nhiêu thì bên phải hẹp đi bấy nhiêu
 * (riêng ranh giới với cột co giãn thì cột co giãn là bên trái), nên tổng độ rộng không đổi.
 */
export function useResizableColumns<K extends string>({
  storageKey,
  defaults,
  mins,
  flexMin,
}: {
  storageKey: string;
  /** Độ rộng mặc định của các cột KHÔNG co giãn (chuỗi CSS, thường là %). */
  defaults: Record<K, string>;
  mins: Record<K, number>;
  /** Cột co giãn không bị ép hẹp hơn mức này khi kéo cột khác. */
  flexMin: number;
}) {
  const [widths, setWidths] = useState<Partial<Record<K, number>>>({});
  const ref = useRef<Partial<Record<K, number>>>({});
  ref.current = widths;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setWidths(JSON.parse(raw) as Partial<Record<K, number>>);
    } catch {
      /* localStorage bị chặn / JSON hỏng: dùng mặc định */
    }
  }, [storageKey]);

  function persist(next: Partial<Record<K, number>>) {
    try {
      if (Object.keys(next).length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* không lưu được thì thôi, chỉ mất khi tải lại */
    }
  }

  /** `left` = cột bên trái ranh giới (null = cột co giãn), `right` = cột bên phải. */
  function startResize(e: React.PointerEvent<HTMLElement>, left: K | null, right: K) {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const leftTh = handle.closest("th");
    const rightTh = leftTh?.nextElementSibling as HTMLElement | null | undefined;
    if (!leftTh || !rightTh) return;

    const startX = e.clientX;
    const startL = leftTh.offsetWidth;
    const startR = rightTh.offsetWidth;
    // dx > 0 = ranh giới đi sang phải. Giới hạn để không cột nào xuống dưới mức tối thiểu.
    const minDx = (left ? mins[left] : flexMin) - startL;
    const maxDx = startR - mins[right];
    handle.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let last: Partial<Record<K, number>> | null = null;
    const onMove = (ev: PointerEvent) => {
      const dx = Math.round(Math.min(maxDx, Math.max(minDx, ev.clientX - startX)));
      const patch: Partial<Record<K, number>> = { [right]: startR - dx } as Partial<Record<K, number>>;
      if (left) patch[left] = startL + dx;
      last = patch;
      setWidths((prev) => ({ ...prev, ...patch }));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Không đọc ref ở đây: React có thể chưa render lại sau lần move cuối.
      if (last) persist({ ...ref.current, ...last });
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function resetEdge(left: K | null, right: K) {
    const next = { ...ref.current };
    delete next[right];
    if (left) delete next[left];
    setWidths(next);
    persist(next);
  }

  function resetAll() {
    setWidths({});
    persist({});
  }

  /** Style cho `<col>` của cột không co giãn. */
  function colStyle(key: K): React.CSSProperties {
    const px = widths[key];
    return { width: px != null ? `${px}px` : defaults[key] };
  }

  /**
   * Thanh kéo đặt trong `<th className="relative">` của cột bên TRÁI ranh giới.
   * Cố ý là HÀM trả JSX chứ không phải component: component định nghĩa trong hook có identity mới mỗi lần
   * render, React sẽ dựng lại thanh kéo giữa lúc đang kéo và mất pointer capture.
   */
  function resizeHandle(left: K | null, right: K, label: string) {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Kéo để đổi độ rộng cột ${label} (nhấp đúp để đặt lại)`}
        title="Kéo để đổi độ rộng · nhấp đúp để đặt lại"
        onPointerDown={(e) => startResize(e, left, right)}
        onDoubleClick={() => resetEdge(left, right)}
        onClick={(e) => e.stopPropagation()}
        className="group absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none select-none justify-center"
      >
        <span className="my-auto h-5 w-0.5 rounded-full bg-[rgb(var(--text-faint))] transition-all group-hover:h-full group-hover:bg-brand-500" />
      </span>
    );
  }

  return { colStyle, resizeHandle, resetAll, customized: Object.keys(widths).length > 0 };
}
