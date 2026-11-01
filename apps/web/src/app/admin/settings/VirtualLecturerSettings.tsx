"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import ToggleRow from "@/components/ui/ToggleRow";

interface Mode {
  value: string;
  label: string;
  hint: string;
}

interface Props {
  initialEnabled: boolean;
  initialMode: string;
  initialLecturer: string;
  modes: Mode[];
  lecturers: { code: string; name: string }[];
}

const FIELD =
  "mt-1 w-full max-w-xs rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

/** Cài đặt giảng viên ảo toàn hệ thống (docs/tieu-chi/giang-vien-ao.md, AC1). Lưu từng ô ngay khi đổi. */
export default function VirtualLecturerSettings({
  initialEnabled,
  initialMode,
  initialLecturer,
  modes,
  lecturers,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [mode, setMode] = useState(initialMode);
  const [lecturer, setLecturer] = useState(initialLecturer);
  const [saving, setSaving] = useState(false);

  async function save(patch: Record<string, unknown>, rollback: () => void) {
    setSaving(true);
    try {
      const r = await fetch(apiUrl("/api/admin/virtual-lecturer"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(String(r.status));
      toast.success("Đã lưu cài đặt giảng viên ảo");
    } catch {
      rollback();
      toast.error("Không lưu được, thử lại sau");
    } finally {
      setSaving(false);
    }
  }

  const hint = modes.find((m) => m.value === mode)?.hint;

  return (
    <section className="card mt-6">
      <header className="border-b border-token pb-4">
        <h2 className="text-base font-semibold">Giảng viên ảo</h2>
        <p className="mt-1 text-xs text-muted">
          Chân dung, phụ đề và giọng giảng trên bài giảng slide đã có giọng đọc. Mức riêng của từng khoá đặt ở
          trang Khoá học và thắng mức mặc định dưới đây.
        </p>
      </header>

      <ToggleRow
        label="Bật giảng viên ảo toàn hệ thống"
        description="Đang tắt thì không nơi nào hiện giảng viên ảo, bất kể cài đặt từng khoá."
        checked={enabled}
        disabled={saving}
        onChange={(next) => {
          setEnabled(next);
          void save({ enabled: next }, () => setEnabled(!next));
        }}
      />

      <div className="space-y-4 border-t border-token py-4">
        <div>
          <label className="text-sm font-semibold" htmlFor="vl-mode">
            Mức mặc định
          </label>
          <select
            id="vl-mode"
            value={mode}
            disabled={saving}
            onChange={(e) => {
              const prev = mode;
              setMode(e.target.value);
              void save({ defaultMode: e.target.value }, () => setMode(prev));
            }}
            className={FIELD}
          >
            {modes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>

        <div>
          <label className="text-sm font-semibold" htmlFor="vl-lecturer">
            Giảng viên mặc định
          </label>
          <select
            id="vl-lecturer"
            value={lecturer}
            disabled={saving}
            onChange={(e) => {
              const prev = lecturer;
              setLecturer(e.target.value);
              void save({ defaultLecturer: e.target.value }, () => setLecturer(prev));
            }}
            className={FIELD}
          >
            {lecturers.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
