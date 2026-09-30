"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";

/** Một lịch: mở/đóng. Ô ngày để trống = không hẹn mốc đó (mở ngay / không đóng). */
export interface Schedule {
  opensEnabled: boolean;
  opensLocal: string;
  dueEnabled: boolean;
  dueLocal: string;
}

export interface SectionDeadlinesHandle {
  /** Lỗi cần sửa trước khi lưu (null = hợp lệ). Gọi TRƯỚC khi lưu phần còn lại của form. */
  validate: () => string | null;
  /** Lưu lịch của các lớp đã đổi. Trả false nếu có lớp chưa lưu được. */
  save: () => Promise<boolean>;
}

interface ServerRow {
  sectionId: string;
  name: string;
  enrolledCount: number;
  mode: "inherit" | "custom";
  opensAt: string | null;
  dueAt: string | null;
}

/** Điều cần ghi cho một lớp: về lịch chung, hoặc lịch riêng với hai mốc (chuỗi giờ VN, rỗng = không có). */
type Target = { kind: "inherit" } | { kind: "custom"; opens: string; due: string };

const ERROR_TEXT: Record<string, string> = {
  section_not_in_course: "Có lớp không thuộc khoá này (hoặc là lớp mặc định) — tải lại trang.",
  invalid_window: "Giờ mở bài phải trước giờ đóng bài.",
  validation_failed: "Dữ liệu chưa hợp lệ.",
  forbidden: "Bạn không có quyền đặt hạn cho khoá này.",
  not_course_item: "Mục này không thuộc lớp nào nên không đặt hạn theo lớp được.",
  not_found: "Không tìm thấy — tải lại trang.",
};

const toSchedule = (opens: string, due: string): Schedule => ({
  opensEnabled: !!opens,
  opensLocal: opens,
  dueEnabled: !!due,
  dueLocal: due,
});

const targetKey = (t: Target) => (t.kind === "inherit" ? "inherit" : JSON.stringify([t.opens, t.due]));

const inputCls = "input h-8 min-w-0 flex-1 px-2 py-0 text-sm";

/** Ô chọn một mốc thời gian; xoá ô = bỏ mốc (hiện chữ mô tả ý nghĩa của ô trống). */
function DateCell({
  label,
  emptyHint,
  value,
  onChange,
}: {
  label: string;
  emptyHint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-[13rem] flex-1">
      <span className="text-[11px] font-medium text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} (giờ Việt Nam)`}
          className={inputCls}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="btn-ghost btn-sm !px-1.5"
            aria-label={`Bỏ ${label.toLowerCase()}`}
            title="Bỏ mốc này"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
      {!value && <p className="mt-0.5 text-[11px] text-faint">{emptyHint}</p>}
    </div>
  );
}

/**
 * Khối "Khi nào học viên được làm bài" (quiz) / "Hạn nộp" (bài tập) — MỘT nơi duy nhất đặt hạn, nằm TRONG form sửa bài.
 *
 * Chỉ có hai chế độ (chọn bằng hai nút radio, chỉ hiện khi khoá có lớp):
 *  1. "Cùng một lịch cho mọi lớp": một hàng "Tất cả học viên" (lịch chung của bài, form cha giữ state qua
 *     `base`/`onBaseChange`). Lưu ở chế độ này sẽ xoá mọi lịch riêng của lớp.
 *  2. "Mỗi lớp một lịch riêng": bảng lớp × (mở, đóng); ô ngày để trống = mở ngay / không đóng. Hàng cuối là lịch chung,
 *     dành cho học viên chưa vào lớp nào và lớp tạo sau.
 * Mọi chỉnh sửa chỉ là NHÁP; form cha bấm Lưu thì gọi `validate()` rồi `save()` (qua ref) — không có nút lưu riêng.
 *
 * Với quiz có hai cột (mở, đóng); với bài tập chỉ có hạn nộp.
 */
const SectionDeadlinesPanel = forwardRef<
  SectionDeadlinesHandle,
  {
    kind: "assignment" | "quiz";
    itemId: string;
    base: Schedule;
    onBaseChange: (next: Schedule) => void;
  }
>(function SectionDeadlinesPanel({ kind, itemId, base, onBaseChange }, ref) {
  const isQuiz = kind === "quiz";
  const endpoint = apiUrl(
    isQuiz ? `/api/quizzes/${itemId}/section-deadlines` : `/api/assignments/${itemId}/section-deadlines`,
  );

  const [rows, setRows] = useState<ServerRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [perClass, setPerClass] = useState(false);
  /** Lịch nháp của các lớp mà người dùng đã đụng tới (lớp chưa đụng: hiện đúng trạng thái đang lưu). */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Lịch đang soạn để áp cho các lớp đã chọn. */
  const [bulk, setBulk] = useState({ opens: "", due: "" });
  const [edited, setEdited] = useState<Record<string, { opens: string; due: string }>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError((d.error && ERROR_TEXT[d.error]) || "Không tải được danh sách lớp.");
        return;
      }
      const sections = ((await res.json()) as { sections: ServerRow[] }).sections;
      setRows(sections);
      setEdited({});
      setSelected(new Set());
      setPerClass(sections.some((s) => s.mode === "custom"));
    } catch {
      setLoadError("Không kết nối được máy chủ.");
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Lịch đang hiển thị của một lớp trong chế độ "mỗi lớp một lịch". */
  function shown(r: ServerRow): { opens: string; due: string } {
    const e = edited[r.sectionId];
    if (e) return e;
    if (r.mode === "custom") {
      return {
        opens: r.opensAt ? toDateTimeInputValue(r.opensAt) : "",
        due: r.dueAt ? toDateTimeInputValue(r.dueAt) : "",
      };
    }
    return { opens: base.opensEnabled ? base.opensLocal : "", due: base.dueEnabled ? base.dueLocal : "" };
  }

  function setCell(r: ServerRow, patch: Partial<{ opens: string; due: string }>) {
    setEdited((prev) => ({ ...prev, [r.sectionId]: { ...shown(r), ...patch } }));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Điền lịch đang soạn vào mọi lớp đã chọn (vẫn là nháp — bấm Lưu của form mới ghi). */
  function applyToSelected() {
    if (!rows || selected.size === 0) return;
    const value = { opens: isQuiz ? bulk.opens : "", due: bulk.due };
    setEdited((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = value;
      return next;
    });
    toast.success(`Đã điền lịch cho ${selected.size} lớp`, { description: "Bấm Lưu để lưu lại." });
    setSelected(new Set());
  }

  /** Điều cần ghi cho từng lớp (chỉ những lớp có thay đổi so với đang lưu). */
  function computeChanges(): Array<{ row: ServerRow; target: Target }> {
    if (!rows) return [];
    const out: Array<{ row: ServerRow; target: Target }> = [];
    const baseOpens = base.opensEnabled ? base.opensLocal : "";
    const baseDue = base.dueEnabled ? base.dueLocal : "";
    for (const r of rows) {
      let target: Target;
      if (!perClass) {
        target = { kind: "inherit" };
      } else {
        const e = edited[r.sectionId];
        if (!e) continue; // chưa đụng tới: giữ nguyên
        // Lớp đang theo lịch chung mà nhập đúng lịch chung → giữ theo lịch chung, không tạo lịch riêng thừa.
        target =
          r.mode === "inherit" && e.opens === baseOpens && e.due === baseDue
            ? { kind: "inherit" }
            : { kind: "custom", opens: isQuiz ? e.opens : "", due: e.due };
      }
      const current: Target =
        r.mode === "inherit"
          ? { kind: "inherit" }
          : {
              kind: "custom",
              opens: isQuiz && r.opensAt ? toDateTimeInputValue(r.opensAt) : "",
              due: r.dueAt ? toDateTimeInputValue(r.dueAt) : "",
            };
      if (targetKey(target) !== targetKey(current)) out.push({ row: r, target });
    }
    return out;
  }

  useImperativeHandle(
    ref,
    () => ({
      validate() {
        for (const { row, target } of computeChanges()) {
          if (target.kind !== "custom") continue;
          if (isQuiz && target.opens && target.due) {
            const o = fromDateTimeInputValue(target.opens);
            const d = fromDateTimeInputValue(target.due);
            if (o && d && new Date(o).getTime() >= new Date(d).getTime()) {
              return `Lớp ${row.name}: giờ mở bài phải trước giờ đóng bài.`;
            }
          }
        }
        return null;
      },

      async save() {
        const changes = computeChanges();
        if (changes.length === 0) return true;
        // Gom các lớp có cùng thay đổi vào một lần gọi API.
        const groups = new Map<string, { ids: string[]; target: Target }>();
        for (const { row, target } of changes) {
          const key = targetKey(target);
          const g = groups.get(key);
          if (g) g.ids.push(row.sectionId);
          else groups.set(key, { ids: [row.sectionId], target });
        }
        try {
          for (const g of groups.values()) {
            const t = g.target;
            const change =
              t.kind === "inherit"
                ? { mode: "inherit" }
                : {
                    mode: "custom",
                    ...(isQuiz ? { opensAt: t.opens ? fromDateTimeInputValue(t.opens) : null } : {}),
                    dueAt: t.due ? fromDateTimeInputValue(t.due) : null,
                  };
            const res = await fetch(endpoint, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sectionIds: g.ids, change }),
            });
            if (!res.ok) {
              const e = (await res.json().catch(() => ({}))) as { error?: string };
              toast.error("Chưa lưu được lịch theo lớp", {
                description: (e.error && ERROR_TEXT[e.error]) || undefined,
              });
              void load(); // phản ánh đúng những gì đã kịp lưu
              return false;
            }
          }
        } catch {
          toast.error("Không kết nối được máy chủ");
          return false;
        }
        await load();
        return true;
      },
    }),
    // computeChanges đọc rows/edited/perClass/base — các giá trị này quyết định handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, edited, perClass, base, isQuiz, endpoint, load],
  );

  const title = isQuiz ? "Khi nào học viên được làm bài?" : "Hạn nộp bài";
  const hasClasses = !!rows && rows.length > 0;
  const openHint = "Mở ngay";
  const dueHint = isQuiz ? "Không đóng" : "Không có hạn";
  const dueLabel = isQuiz ? "Đóng lúc" : "Hạn nộp";

  /** Hai ô ngày của một dòng (bài tập chỉ có ô hạn nộp). */
  function cells(v: { opens: string; due: string }, set: (p: Partial<{ opens: string; due: string }>) => void) {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {isQuiz && (
          <DateCell label="Mở lúc" emptyHint={openHint} value={v.opens} onChange={(opens) => set({ opens })} />
        )}
        <DateCell label={dueLabel} emptyHint={dueHint} value={v.due} onChange={(due) => set({ due })} />
      </div>
    );
  }

  const baseValue = {
    opens: base.opensEnabled ? base.opensLocal : "",
    due: base.dueEnabled ? base.dueLocal : "",
  };
  const setBase = (p: Partial<{ opens: string; due: string }>) => {
    const next = { ...baseValue, ...p };
    onBaseChange(toSchedule(next.opens, next.due));
  };

  const radio = (checked: boolean, onSelect: () => void, text: string) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="radio" name={`sd-mode-${itemId}`} checked={checked} onChange={onSelect} />
      {text}
    </label>
  );

  return (
    <fieldset className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>

      {loadError && (
        <p className="text-sm text-danger-700">
          {loadError}{" "}
          <button type="button" className="link" onClick={() => void load()}>
            Thử lại
          </button>
        </p>
      )}

      {hasClasses && (
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {radio(
            !perClass,
            () => {
              setPerClass(false);
              setSelected(new Set());
            },
            "Cùng một lịch cho mọi lớp",
          )}
          {radio(
            perClass,
            () => setPerClass(true),
            isQuiz ? "Mỗi lớp một lịch riêng" : "Mỗi lớp một hạn riêng",
          )}
        </div>
      )}

      {perClass && rows && rows.length > 1 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === rows.length}
            onChange={(e) => setSelected(new Set(e.target.checked ? rows.map((r) => r.sectionId) : []))}
          />
          Chọn tất cả lớp
        </label>
      )}

      <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-token">
        {perClass &&
          rows?.map((r) => (
            <li key={r.sectionId} className="space-y-2 px-3 py-2.5">
              <label className="flex w-fit min-w-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(r.sectionId)}
                  onChange={() => toggle(r.sectionId)}
                  aria-label={`Chọn ${r.name}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="text-[11px] text-faint">{r.enrolledCount} học viên</span>
                </span>
              </label>
              {cells(shown(r), (p) => setCell(r, p))}
            </li>
          ))}

        <li className={`space-y-2 px-3 py-2.5 ${perClass ? "bg-[rgb(var(--surface-muted))]" : ""}`}>
          <div className="min-w-0">
            <p className="text-sm font-medium">{perClass ? "Chưa vào lớp nào" : "Tất cả học viên"}</p>
            {perClass && <p className="text-[11px] text-faint">Áp cho học viên chưa có lớp và lớp tạo sau</p>}
          </div>
          {cells(baseValue, setBase)}
        </li>
      </ul>

      {perClass && selected.size > 0 && (
        <div className="space-y-2 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3">
          <p className="text-xs font-semibold">
            Đặt {isQuiz ? "lịch" : "hạn nộp"} chung cho {selected.size} lớp đã chọn
          </p>
          {cells(bulk, (p) => setBulk((prev) => ({ ...prev, ...p })))}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={applyToSelected} className="btn-primary btn-sm">
              Áp dụng cho {selected.size} lớp đã chọn
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost btn-sm">
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        {isQuiz
          ? "Để trống ô nào thì không giới hạn ở mốc đó (mở ngay / không đóng)."
          : "Để trống thì bài không có hạn nộp."}
        {hasClasses && !perClass && rows?.some((r) => r.mode === "custom")
          ? " Lưu ở chế độ này sẽ xoá lịch riêng đã đặt cho từng lớp."
          : ""}
      </p>
    </fieldset>
  );
});

export default SectionDeadlinesPanel;
