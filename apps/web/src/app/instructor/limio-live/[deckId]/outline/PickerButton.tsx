import type { OutlineKind, OutlineLayout } from "@/lib/limioLiveOutline";
import { ChevronDown } from "lucide-react";
import OutlineGlyph from "./OutlineGlyph";

/** Khung chọn gọn: hình nhỏ + nhãn + giá trị hiện tại; bấm để mở lưới hình chọn lại. Dùng ở màn dàn ý và màn sửa slide. */
export default function PickerButton({
  cap,
  glyph,
  label,
  open,
  onClick,
}: {
  cap: string;
  glyph: OutlineLayout | OutlineKind;
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${
        open ? "border-brand-600 bg-brand-soft ring-1 ring-brand-600" : "border-token bg-[rgb(var(--surface-muted))] hover:border-brand-600"
      }`}
    >
      <OutlineGlyph k={glyph} className="h-7 w-[42px] shrink-0 text-brand-700" />
      <span className="grid min-w-0 flex-1 leading-tight">
        <small className="text-xs font-semibold text-faint">{cap}</small>
        <b className="truncate text-[15px]">{label}</b>
      </span>
      <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}
