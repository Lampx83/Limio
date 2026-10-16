import { Check } from "lucide-react";

/**
 * Khung chung cho các màn trước khi làm bài: phòng chờ và "Sẵn sàng vào thi".
 * Giữ cùng một bố cục để học viên thấy đây là một luồng liền mạch ba bước.
 */
export function EntryStepper({
  step,
  firstStepLabel = "Đăng nhập",
}: {
  step: 1 | 2 | 3;
  /** Bước đầu: "Đăng nhập" với mã chung, "Nhập mã" với mã cá nhân (không cần tài khoản). */
  firstStepLabel?: string;
}) {
  const STEPS = [firstStepLabel, "Phòng chờ", "Làm bài"];
  return (
    <ol className="flex items-center justify-center gap-2 text-xs" aria-label="Các bước vào thi">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                done
                  ? "bg-brand-600 text-white"
                  : current
                    ? "bg-brand-100 text-brand-800 ring-2 ring-brand-500 dark:bg-brand-900 dark:text-brand-100"
                    : "bg-[rgb(var(--surface-muted))] text-faint"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
            </span>
            {/* Màn hình hẹp chỉ hiện nhãn bước hiện tại để thanh bước không xuống dòng. */}
            <span
              className={`whitespace-nowrap ${
                current ? "font-semibold text-[rgb(var(--text))]" : "hidden text-faint sm:inline"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`mx-0.5 h-px w-5 sm:mx-1 sm:w-10 ${done ? "bg-brand-500" : "bg-[rgb(var(--border))]"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function EntryShell({
  step,
  firstStepLabel,
  children,
}: {
  step: 1 | 2 | 3;
  firstStepLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden px-4 py-8 sm:py-12">
      {/* Nền: quầng sáng lime nhẹ phía trên, không tranh chỗ với nội dung. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(var(--brand)/0.14),transparent)]"
      />
      <div className="mx-auto w-full max-w-xl">
        <EntryStepper step={step} firstStepLabel={firstStepLabel} />
        <div className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 shadow-card sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

/** Dải thông tin ngắn về đề (thời lượng, số câu, giờ mở…). */
export function EntryFacts({
  items,
}: {
  items: { icon: React.ReactNode; label: string; value: string; sub?: string }[];
}) {
  return (
    <dl
      className={`grid gap-2 sm:gap-3 ${
        items.length === 1
          ? "mx-auto max-w-[11rem] grid-cols-1"
          : items.length === 2
            ? "grid-cols-2"
            : "grid-cols-3"
      }`}
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] px-2 py-3 text-center sm:px-3"
        >
          <dt className="flex flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
            <span aria-hidden className="text-brand-600">{it.icon}</span>
            <span>{it.label}</span>
          </dt>
          <dd className="mt-1.5 text-sm font-semibold leading-tight text-[rgb(var(--text))] sm:text-base">
            {it.value}
            {it.sub && <span className="mt-0.5 block text-xs font-normal text-muted">{it.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Lời chào theo tài khoản đang đăng nhập — dùng chung cho mọi màn trước khi làm bài. */
export function EntryGreeting({ name }: { name: string }) {
  if (!name) return null;
  return (
    <p className="text-center text-sm text-muted">
      Xin chào, <b className="text-[rgb(var(--text))]">{name}</b>
    </p>
  );
}
