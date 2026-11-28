import { BookOpen, Globe, Headphones, Languages, Mic, Pencil, PencilLine, Puzzle, type LucideIcon } from "lucide-react";
import { practicePurposeChipStyle, type PracticePurpose, type PracticePurposeKey } from "@/lib/practicePurpose";

export const PRACTICE_PURPOSE_ICON: Record<PracticePurposeKey, LucideIcon> = {
  vocab: Languages,
  grammar: Puzzle,
  culture: Globe,
  dialogue: Headphones,
  reading: BookOpen,
  speaking: Mic,
  writing: Pencil,
  speakwrite: PencilLine,
};

/** Chip mục đích của một khối luyện (biểu tượng + tên mục đích), màu cố định theo mục đích. */
export default function PracticePurposeChip({ purpose, size = 14 }: { purpose: PracticePurpose; size?: number }) {
  const Icon = PRACTICE_PURPOSE_ICON[purpose.key];
  return (
    <span
      data-testid="practice-purpose-chip"
      data-purpose={purpose.key}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={practicePurposeChipStyle(purpose)}
    >
      <Icon size={size} aria-hidden />
      {purpose.label}
    </span>
  );
}
