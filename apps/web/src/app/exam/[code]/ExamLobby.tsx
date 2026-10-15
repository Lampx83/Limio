"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { formatVN } from "@/lib/datetime";
import EntryShell, { EntryFacts, EntryGreeting } from "@/components/exam/EntryShell";

type Conn = "ok" | "retrying";

const R = 74;
const C = 2 * Math.PI * R;

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Phòng chờ trước giờ thi. Chỉ đếm ngược và giữ nhịp tim; KHÔNG tạo lượt làm và
 * không tính giờ làm bài. Khi ca mở, làm mới trang để chuyển sang bước vào thi.
 */
export default function ExamLobby({
  code,
  examTitle,
  subtitle,
  opensAt,
  manual,
  leadMin,
  displayName,
  strict,
}: {
  code: string;
  examTitle: string;
  subtitle: string | null;
  opensAt: string;
  /** Ca thủ công: giảng viên bấm mở, không có giờ để đếm ngược. */
  manual: boolean;
  /** Lobby mở trước giờ thi bao nhiêu phút (để vẽ tiến độ vòng tròn). */
  leadMin: number;
  displayName: string;
  /** Mức giám sát nghiêm ngặt: cần Safe Exam Browser. */
  strict: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [conn, setConn] = useState<Conn>("ok");
  const opensMs = new Date(opensAt).getTime();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Nhịp tim: báo đang có mặt, và hỏi khi nào ca mở.
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        const r = await fetch(apiUrl(`/api/exam-lobby/${code}`), { method: "POST" });
        if (!alive) return;
        if (r.status === 401) {
          router.replace(`/signin?callbackUrl=${encodeURIComponent(`/exam/${code}`)}`);
          return;
        }
        if (!r.ok) {
          setConn("retrying");
          return;
        }
        setConn("ok");
        const j = (await r.json()) as { phase: string };
        // Ca đã mở hoặc đã đóng: làm mới để máy chủ quyết định trang kế tiếp.
        if (j.phase === "open" || j.phase === "closed") router.refresh();
      } catch {
        if (alive) setConn("retrying");
      }
    };
    beat();
    const t = setInterval(beat, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code, router]);

  const remainingSec = Math.max(0, Math.ceil((opensMs - now) / 1000));
  const opening = !manual && remainingSec === 0;
  const totalMs = Math.max(1, leadMin * 60_000);
  const progress = manual
    ? 0
    : Math.min(1, Math.max(0, 1 - (opensMs - now) / totalMs));
  const urgent = !manual && remainingSec > 0 && remainingSec <= 60;
  const openTime = formatVN(new Date(opensMs), { hour: "2-digit", minute: "2-digit" });
  const openDate = `${formatVN(new Date(opensMs), { day: "2-digit" })}/${formatVN(new Date(opensMs), { month: "2-digit" })}`;

  const ringColor = opening
    ? "stroke-emerald-500"
    : urgent
      ? "stroke-accent-500"
      : "stroke-brand-500";

  return (
    <EntryShell step={2}>
      {/* Trạng thái kết nối */}
      <div className="flex justify-center">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            conn === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
          role="status"
        >
          {conn === "ok" ? (
            <>
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Wifi className="h-3.5 w-3.5" aria-hidden />
              Đã vào phòng chờ
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
              Mất kết nối, đang thử lại…
            </>
          )}
        </span>
      </div>

      <div className="mt-5">
        <EntryGreeting name={displayName} />
      </div>
      <div className="mt-2 text-center">
        <h1 className="text-h2 text-[rgb(var(--text))]">{examTitle}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      {/* Vòng đếm ngược. Câu dẫn chỉ có khi có giờ để đếm (ca hẹn giờ, chưa mở). */}
      {!manual && !opening && (
        <p className="mt-7 text-center text-base font-medium text-[rgb(var(--text))]">
          Vui lòng chờ, phòng thi sẽ mở sau:
        </p>
      )}
      <div className={`${!manual && !opening ? "mt-3" : "mt-7"} flex justify-center`}>
        <div className="relative h-52 w-52 sm:h-56 sm:w-56">
          <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden>
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              strokeWidth="10"
              className="stroke-slate-200 dark:stroke-slate-700"
            />
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={manual ? C * 0.75 : C * (1 - (opening ? 1 : progress))}
              className={`${ringColor} transition-[stroke-dashoffset] duration-1000 ease-linear ${
                manual ? "origin-center animate-spin [animation-duration:6s]" : ""
              }`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {manual ? (
              <>
                <Clock className="h-9 w-9 text-brand-600" aria-hidden />
                <p className="mt-2 px-6 text-sm font-medium text-[rgb(var(--text))]">
                  Đang chờ giảng viên bắt đầu
                </p>
              </>
            ) : opening ? (
              <>
                <Loader2 className="h-9 w-9 animate-spin text-emerald-600" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Ca thi đã mở
                </p>
                <p className="text-xs text-muted">Đang chuyển trang…</p>
              </>
            ) : (
              <>
                <p
                  role="timer"
                  aria-live="off"
                  aria-label="Thời gian còn lại đến giờ mở phòng thi"
                  className={`font-mono text-5xl font-bold tabular-nums tracking-tight ${
                    urgent ? "text-accent-600 dark:text-accent-400" : "text-[rgb(var(--text))]"
                  }`}
                >
                  {fmt(remainingSec)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Đọc cho trình đọc màn hình mỗi phút một lần, không đọc từng giây. */}
      <p className="sr-only" aria-live="polite">
        {manual
          ? "Đang chờ giảng viên bắt đầu ca thi."
          : opening
            ? "Ca thi đã mở."
            : `Còn khoảng ${Math.ceil(remainingSec / 60)} phút đến giờ mở.`}
      </p>

      <div className="mt-7">
        <EntryFacts
          items={[
            manual
              ? { icon: <Clock className="h-3.5 w-3.5" />, label: "Bắt đầu", value: "Thủ công", sub: "GV bấm mở" }
              : { icon: <Clock className="h-3.5 w-3.5" />, label: "Giờ mở", value: openTime, sub: openDate },
          ]}
        />
      </div>

      <ul className="mt-6 space-y-2.5 text-sm text-muted">
        <li className="flex gap-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <span>Giữ trang này mở. Khi ca thi mở, bạn sẽ được chuyển sang bước vào thi.</span>
        </li>
        <li className="flex gap-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <span>
            Thời gian làm bài chỉ bắt đầu khi bạn bấm <b className="text-[rgb(var(--text))]">Vào thi</b>,
            không tính lúc đang chờ.
          </span>
        </li>
        <li className="flex gap-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <span>Kiểm tra mạng và pin ổn định, đóng các ứng dụng không cần thiết.</span>
        </li>
        {strict && (
          <li className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />
            <span>Bài thi này yêu cầu dùng Safe Exam Browser để làm bài.</span>
          </li>
        )}
      </ul>

    </EntryShell>
  );
}
