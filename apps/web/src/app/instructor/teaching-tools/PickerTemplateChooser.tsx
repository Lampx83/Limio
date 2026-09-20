"use client";

import { ArrowRight, Shuffle } from "lucide-react";
import type { PickerTemplate } from "../classroom/RandomPicker";

const WHEEL_COLORS = ["#FBBF24", "#EF4444", "#F97316", "#EC4899", "#8B5CF6", "#22C55E"];

function WheelPreview() {
  const r = 62;
  const step = (Math.PI * 2) / WHEEL_COLORS.length;
  const point = (a: number) => `${70 + r * Math.sin(a)} ${70 - r * Math.cos(a)}`;
  return (
    <svg viewBox="0 0 140 150" className="h-24 w-24 transition-transform duration-500 group-hover:rotate-[24deg]" aria-hidden>
      <g transform="translate(0 10)">
        {WHEEL_COLORS.map((c, i) => (
          <path
            key={c}
            d={`M70 70 L${point(i * step)} A${r} ${r} 0 0 1 ${point((i + 1) * step)} Z`}
            fill={c}
            stroke="#fff"
            strokeWidth="2"
          />
        ))}
        <circle cx="70" cy="70" r="13" fill="#111827" />
      </g>
      <path d="M70 18 L62 2 H78 Z" fill="#111827" transform="translate(0 0)" />
    </svg>
  );
}

function SlotPreview() {
  const rows = ["Trần Thị B", "Nguyễn Văn A", "Phạm Văn C"];
  return (
    <div className="w-32 overflow-hidden rounded-xl border-2 border-gray-900 bg-white shadow-sm" aria-hidden>
      {rows.map((n, i) => (
        <div
          key={n}
          className={
            i === 1
              ? "bg-brand-600 py-2 text-center text-xs font-bold text-white"
              : "py-1.5 text-center text-[11px] text-faint transition-transform duration-500 group-hover:-translate-y-1"
          }
        >
          {n}
        </div>
      ))}
    </div>
  );
}

const OPTIONS: Array<{
  key: PickerTemplate;
  label: string;
  desc: string;
  tag: string;
  preview: React.ReactNode;
}> = [
  {
    key: "wheel",
    label: "Vòng quay may mắn",
    desc: "Tên chia thành các múi màu, kim chỉ vào người trúng. Hợp với lớp đông, cần không khí sôi nổi.",
    tag: "Wheel of Names",
    preview: <WheelPreview />,
  },
  {
    key: "slot",
    label: "Thanh quay casino",
    desc: "Tên chạy nhanh trên máy quay dọc rồi dừng lại. Gọn, rõ tên, dễ đọc từ cuối lớp.",
    tag: "Slot machine",
    preview: <SlotPreview />,
  },
];

export default function PickerTemplateChooser({ onSelect }: { onSelect: (t: PickerTemplate) => void }) {
  return (
    <div className="mx-auto max-w-2xl py-2 sm:py-4">
      <div className="text-center">
        <span className="tool-icon mx-auto">
          <Shuffle size={20} strokeWidth={1.75} />
        </span>
        <h2 className="text-h1 mt-3">Gọi tên sinh viên</h2>
        <p className="text-body text-muted mx-auto mt-2 max-w-lg">
          Chọn hiệu ứng quay. Bước tiếp theo bạn sẽ nhập hoặc chọn danh sách sinh viên.
        </p>
      </div>

      <div className="mt-6 grid gap-14 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-token bg-white text-left transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <div className="flex h-36 items-center justify-center bg-[rgb(var(--brand-soft))]">{o.preview}</div>
            <div className="flex flex-1 flex-col p-4">
              <span className="text-caption font-semibold uppercase tracking-wide text-brand-600">{o.tag}</span>
              <span className="text-h4 mt-0.5 font-semibold">{o.label}</span>
              <span className="text-meta text-muted mt-1.5 flex-1">{o.desc}</span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:text-brand-700">
                Chọn kiểu này
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
