"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime, fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";

interface Row {
  sectionId: string;
  name: string;
  enrolledCount: number;
  mode: "inherit" | "custom";
  opensAt: string | null;
  dueAt: string | null;
}

interface Data {
  base: { opensAt: string | null; dueAt: string | null };
  sections: Row[];
}

const ERROR_TEXT: Record<string, string> = {
  section_not_in_course: "Có lớp không thuộc khoá này (hoặc là lớp mặc định) — tải lại trang.",
  invalid_window: "Hạn mở phải trước hạn đóng.",
  validation_failed: "Dữ liệu chưa hợp lệ.",
  forbidden: "Bạn không có quyền đặt hạn cho khoá này.",
  not_course_item: "Mục này không thuộc lớp nào nên không đặt hạn theo lớp được.",
  not_found: "Không tìm thấy — tải lại trang.",
};

/**
 * "Hạn theo lớp" cho bài tập / quiz. Hạn chung (ô ở form phía trên) là mặc định; ở đây giáo viên
 * tick MỘT hay NHIỀU lớp rồi đặt một hạn chung cho các lớp đó, hoặc bấm "Sửa" trên một dòng để đặt riêng.
 * Lớp không có hạn riêng (kể cả lớp tạo sau) tự theo hạn chung. Đặt hạn chung mới ở form trên
 * KHÔNG động vào lớp đã có hạn riêng.
 *
 * Với quiz, một lớp có lịch đầy đủ riêng (cả Hạn mở lẫn Hạn đóng); với bài tập chỉ có hạn nộp.
 */
export default function SectionDeadlinesPanel({
  kind,
  itemId,
}: {
  kind: "assignment" | "quiz";
  itemId: string;
}) {
  const isQuiz = kind === "quiz";
  const endpoint = apiUrl(
    isQuiz ? `/api/quizzes/${itemId}/section-deadlines` : `/api/assignments/${itemId}/section-deadlines`,
  );

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opensLocal, setOpensLocal] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [noOpens, setNoOpens] = useState(true);
  const [noDue, setNoDue] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError((d.error && ERROR_TEXT[d.error]) || "Không tải được hạn theo lớp.");
        return;
      }
      setData((await res.json()) as Data);
    } catch {
      setLoadError("Không kết nối được máy chủ.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // Chỉ tải khi mở lần đầu — đa số bài không dùng hạn theo lớp.
  useEffect(() => {
    if (open && !data && !loading && !loadError) void load();
  }, [open, data, loading, loadError, load]);

  const customCount = data?.sections.filter((s) => s.mode === "custom").length ?? 0;
  const allIds = useMemo(() => data?.sections.map((s) => s.sectionId) ?? [], [data]);

  /** Điền form theo giá trị hiện tại của các lớp đang chọn (một lớp) hoặc theo hạn chung (nhiều lớp/chưa chọn). */
  function prefill(ids: string[], from: Data) {
    const only = ids.length === 1 ? from.sections.find((s) => s.sectionId === ids[0]) : undefined;
    const src = only && only.mode === "custom" ? only : from.base;
    setOpensLocal(src.opensAt ? toDateTimeInputValue(src.opensAt) : "");
    setDueLocal(src.dueAt ? toDateTimeInputValue(src.dueAt) : "");
    setNoOpens(!src.opensAt);
    setNoDue(only?.mode === "custom" ? !only.dueAt : false);
  }

  function toggle(id: string) {
    if (!data) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    prefill([...next], data);
  }

  function editOne(id: string) {
    if (!data) return;
    setSelected(new Set([id]));
    prefill([id], data);
  }

  async function send(change: unknown, okMessage: string) {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionIds: [...selected], change }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error("Chưa lưu được hạn theo lớp", {
          description: (d.error && ERROR_TEXT[d.error]) || undefined,
        });
        return;
      }
      setData((await res.json()) as Data);
      setSelected(new Set());
      toast.success(okMessage);
    } catch {
      toast.error("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    const dueAt = noDue ? null : fromDateTimeInputValue(dueLocal);
    if (!noDue && !dueAt) {
      toast.error("Chọn ngày giờ cho hạn, hoặc tick “Không có hạn”.");
      return;
    }
    if (!isQuiz) {
      void send({ mode: "custom", dueAt }, `Đã đặt hạn cho ${selected.size} lớp`);
      return;
    }
    const opensAt = noOpens ? null : fromDateTimeInputValue(opensLocal);
    if (!noOpens && !opensAt) {
      toast.error("Chọn ngày giờ cho hạn mở, hoặc tick “Mở ngay”.");
      return;
    }
    if (opensAt && dueAt && new Date(opensAt).getTime() >= new Date(dueAt).getTime()) {
      toast.error("Hạn mở phải trước hạn đóng.");
      return;
    }
    void send({ mode: "custom", opensAt, dueAt }, `Đã đặt lịch cho ${selected.size} lớp`);
  }

  const baseText = data
    ? isQuiz
      ? `mở ${data.base.opensAt ? formatDateTime(data.base.opensAt) : "ngay"} · đóng ${data.base.dueAt ? formatDateTime(data.base.dueAt) : "không hạn"}`
      : data.base.dueAt
        ? formatDateTime(data.base.dueAt)
        : "không có hạn"
    : "";

  const inputCls = "input h-8 px-2 py-0 text-sm";

  return (
    <div className="rounded-xl border border-token bg-[rgb(var(--surface))]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold"
      >
        <span>
          {isQuiz ? "Lịch theo lớp" : "Hạn theo lớp"}
          {data && customCount > 0 && (
            <span className="ml-2 chip-brand text-[11px] font-medium">{customCount} lớp có hạn riêng</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-token px-3 py-3">
          {loading && <p className="text-sm text-muted">Đang tải…</p>}
          {loadError && (
            <p className="text-sm text-danger-700">
              {loadError}{" "}
              <button type="button" className="link" onClick={() => void load()}>
                Thử lại
              </button>
            </p>
          )}

          {data && data.sections.length === 0 && (
            <p className="text-sm text-muted">
              Khoá này chưa có lớp nào. Tạo lớp ở tab “Lớp học” để đặt hạn riêng cho từng lớp; học viên chưa
              gán lớp luôn theo hạn chung.
            </p>
          )}

          {data && data.sections.length > 0 && (
            <>
              <p className="text-xs text-muted">
                Hạn chung ({baseText}) áp dụng cho các lớp không có hạn riêng và học viên chưa gán lớp. Tick một
                hoặc nhiều lớp để đặt chung một hạn, hoặc bấm “Sửa” để đặt riêng từng lớp.
              </p>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === allIds.length}
                    onChange={(e) => {
                      const next = new Set(e.target.checked ? allIds : []);
                      setSelected(next);
                      prefill([...next], data);
                    }}
                  />
                  Chọn tất cả lớp
                </label>
                <span className="text-faint">{selected.size} lớp đang chọn</span>
              </div>

              <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-token">
                {data.sections.map((s) => (
                  <li key={s.sectionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <label className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(s.sectionId)}
                        onChange={() => toggle(s.sectionId)}
                        aria-label={`Chọn ${s.name}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="text-[11px] text-faint">{s.enrolledCount} học viên</span>
                      </span>
                    </label>
                    <span className={`text-xs ${s.mode === "custom" ? "font-medium text-brand-700" : "text-muted"}`}>
                      {s.mode === "inherit"
                        ? "Theo hạn chung"
                        : isQuiz
                          ? `Mở ${s.opensAt ? formatDateTime(s.opensAt) : "ngay"} · đóng ${s.dueAt ? formatDateTime(s.dueAt) : "không hạn"}`
                          : s.dueAt
                            ? formatDateTime(s.dueAt)
                            : "Không có hạn"}
                    </span>
                    <button type="button" onClick={() => editOne(s.sectionId)} className="btn-ghost btn-sm">
                      Sửa
                    </button>
                  </li>
                ))}
              </ul>

              {selected.size > 0 && (
                <div className="space-y-2 rounded-lg bg-[rgb(var(--surface-muted))] p-3">
                  <p className="text-xs font-semibold">
                    Đặt {isQuiz ? "lịch" : "hạn"} cho {selected.size} lớp đã chọn
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    {isQuiz && (
                      <div>
                        <label className="text-xs font-medium" htmlFor={`sd-opens-${itemId}`}>
                          Hạn mở
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            id={`sd-opens-${itemId}`}
                            type="datetime-local"
                            value={opensLocal}
                            disabled={noOpens}
                            onChange={(e) => setOpensLocal(e.target.value)}
                            className={inputCls}
                          />
                          <label className="flex items-center gap-1 text-xs">
                            <input type="checkbox" checked={noOpens} onChange={(e) => setNoOpens(e.target.checked)} />
                            Mở ngay
                          </label>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium" htmlFor={`sd-due-${itemId}`}>
                        {isQuiz ? "Hạn đóng" : "Hạn nộp"}
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id={`sd-due-${itemId}`}
                          type="datetime-local"
                          value={dueLocal}
                          disabled={noDue}
                          onChange={(e) => setDueLocal(e.target.value)}
                          className={inputCls}
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={noDue} onChange={(e) => setNoDue(e.target.checked)} />
                          Không có hạn
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={apply} disabled={busy} className="btn-primary btn-sm">
                      {busy ? "Đang lưu…" : `Áp dụng cho ${selected.size} lớp`}
                    </button>
                    <button
                      type="button"
                      onClick={() => void send({ mode: "inherit" }, `${selected.size} lớp đã về hạn chung`)}
                      disabled={busy}
                      className="btn-secondary btn-sm"
                    >
                      Dùng hạn chung
                    </button>
                    <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost btn-sm">
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
