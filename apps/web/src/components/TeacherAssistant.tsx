import Link from "next/link";
import { ASSISTANT_ICONS } from "./assistant/icons";
// Chỉ import kiểu: teacherAssistant.ts kéo theo cả chuỗi limioLiveChat (phía server), không để vào bundle trình duyệt.
import type { AssistantStarter } from "@/lib/teacherAssistant";

/**
 * Đầu trang chủ giảng viên: lời chào và các thẻ "Bắt đầu nhanh" gợi việc nên làm. Không có ô chat ở đây: Lily, trợ lý
 * ảo, đã có nút nổi "Hỏi Lily" ở góc phải mọi trang giảng viên (AssistantLauncher), trang chủ cũng vậy.
 */
export default function TeacherAssistant({ starters, greeting, name }: { starters: AssistantStarter[]; greeting: string; name: string }) {
  return (
    <section aria-labelledby="teacher-assistant-heading">
      <h1 id="teacher-assistant-heading" className="text-h3">
        {greeting}, <span className="text-gradient">{name}</span>!
      </h1>
      <p className="mt-0.5 text-sm text-muted">Thầy/cô muốn làm gì hôm nay? Chọn một việc bên dưới, hoặc bấm "Hỏi Lily" ở góc phải để được hướng dẫn.</p>

      {/* grid-cols-1 = minmax(0,1fr): cột được phép co lại, nếu không chữ không xuống dòng sẽ làm cột phình ra và tràn khỏi khung trên màn hẹp. */}
      <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
        {starters.map((s, i) => (
          <li key={s.id} className="min-w-0">
            <StarterTile starter={s} tone={TONES[i % TONES.length]!} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Tone {
  /** Ô biểu tượng: nền nhạt + biểu tượng đậm. */
  chip: string;
  /** Vệt màu dọc mép trái thẻ. */
  bar: string;
}

/** Màu mỗi thẻ (cùng kiểu danh sách việc gấp), xoay vòng theo vị trí. */
const TONES: readonly Tone[] = [
  { chip: "bg-[rgb(var(--brand-soft))] text-brand-600", bar: "bg-brand-500" },
  { chip: "bg-pink-50 text-pink-600", bar: "bg-pink-500" },
  { chip: "bg-sky-50 text-sky-600", bar: "bg-sky-500" },
  { chip: "bg-violet-50 text-violet-600", bar: "bg-violet-500" },
  { chip: "bg-teal-50 text-teal-600", bar: "bg-teal-500" },
  { chip: "bg-[rgb(var(--brand-soft))] text-brand-700", bar: "bg-brand-600" },
];

function StarterTile({ starter, tone }: { starter: AssistantStarter; tone: Tone }) {
  const Icon = ASSISTANT_ICONS[starter.icon];
  return (
    <Link
      href={starter.href}
      prefetch={false}
      className="card-hover relative flex h-full w-full items-center gap-3 overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] py-2.5 pl-4 pr-3 text-left transition-colors hover:bg-[rgb(var(--surface-muted))]"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.chip}`} aria-hidden>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug sm:truncate">{starter.title}</span>
        <span className="block text-xs text-muted sm:truncate">{starter.subtitle}</span>
      </span>
      <span className="shrink-0 text-sm text-faint" aria-hidden>→</span>
    </Link>
  );
}
