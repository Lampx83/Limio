"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Volume2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

const SKILL_LABEL: Record<string, string> = { listening: "Nghe", speaking: "Nói", reading: "Đọc", writing: "Viết" };

export interface PreRoomSection {
  title: string;
  languageSkill: string | null;
  durationMin: number;
}

/**
 * LANG G5c.5 — màn TRƯỚC phòng thi thử: cấu trúc các phần và giờ, quy tắc, nút thử loa, và
 * xác nhận "Tôi đã sẵn sàng". Đồng hồ chỉ bắt đầu chạy khi bấm xác nhận (lúc đó mới tạo lượt thi).
 */
export default function ExamPreRoom({
  slug,
  examId,
  title,
  sections,
  hasAudio,
  audioRule,
  retake,
  attemptNo,
}: {
  slug: string;
  examId: string;
  title: string;
  sections: PreRoomSection[];
  hasAudio: boolean;
  /** Câu quy tắc về bài nghe (null nếu bài nghe không giới hạn hoặc không có audio). */
  audioRule: string | null;
  retake: boolean;
  /** Đây là lượt thứ mấy của học viên (1 = lần đầu). */
  attemptNo: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beeped, setBeeped] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const total = sections.reduce((n, s) => n + s.durationMin, 0);

  // Thử loa bằng âm 440 Hz tạo ngay trong trình duyệt (không cần file): nghe được tiếng là loa/tai nghe ổn.
  function testSpeaker() {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = (ctxRef.current ??= new Ctx());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
      setBeeped(true);
    } catch {
      setError("Trình duyệt không phát được âm thanh thử. Kiểm tra loa hoặc quyền âm thanh của trình duyệt.");
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/attempts`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retake }),
      });
      const j = (await res.json().catch(() => null)) as { attemptId?: string; sessionToken?: string; error?: string } | null;
      if (!res.ok || !j?.attemptId) {
        setError(
          j?.error === "mock_disabled"
            ? "Giảng viên đã tạm tắt thi thử cho đề này."
            : "Không bắt đầu được. Vui lòng thử lại.",
        );
        setBusy(false);
        return;
      }
      router.replace(`/learn/${slug}/exams/${examId}/${j.attemptId}?st=${encodeURIComponent(j.sessionToken ?? "")}`);
    } catch {
      setError("Không bắt đầu được. Kiểm tra mạng rồi thử lại.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid="exam-preroom">
      <Link href={`/learn/${slug}`} className="text-sm text-blue-600 underline">
        ← Về trang khoá
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-faint">
        {attemptNo > 1 ? `Lượt thi thử thứ ${attemptNo}` : "Thi thử"} · {sections.length} phần · {total} phút
      </p>

      <section className="mt-6 rounded border border-default bg-white p-5">
        <h2 className="mb-3 text-base font-semibold">Cấu trúc bài thi</h2>
        <ol className="space-y-2">
          {sections.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded border border-default px-3 py-2">
              <span>
                <span className="mr-2 text-faint">{i + 1}.</span>
                <span className="font-medium">{s.title}</span>
                {s.languageSkill && SKILL_LABEL[s.languageSkill] !== s.title && (
                  <span className="ml-2 text-xs text-faint">({SKILL_LABEL[s.languageSkill]})</span>
                )}
              </span>
              <span className="font-mono text-sm tabular-nums">{s.durationMin} phút</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 rounded border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
        <h2 className="mb-2 text-base font-semibold">Quy tắc phòng thi</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Đồng hồ bắt đầu chạy NGAY khi bạn bấm “Tôi đã sẵn sàng”. Rời khỏi trang, đồng hồ vẫn chạy.</li>
          <li>Làm lần lượt từng phần. Hết giờ phần thì tự sang phần kế; nộp phần sớm cũng không quay lại được.</li>
          <li>Thời gian còn lại của một phần không được cộng sang phần sau.</li>
          {audioRule && <li>{audioRule}</li>}
          <li>Đáp án chỉ hiện sau khi nộp xong. Thi thử không cộng điểm XP.</li>
        </ul>
      </section>

      {hasAudio && (
        <section className="mt-4 rounded border border-default bg-white p-5">
          <h2 className="mb-2 text-base font-semibold">Kiểm tra loa / tai nghe</h2>
          <p className="mb-3 text-sm text-faint">Bấm nút và kiểm tra bạn nghe được tiếng “bíp” trước khi vào thi.</p>
          <button
            type="button"
            onClick={testSpeaker}
            className="inline-flex items-center gap-2 rounded border border-default px-4 py-1.5 text-sm hover:bg-slate-50"
          >
            <Volume2 size={16} aria-hidden /> Thử loa
          </button>
          {beeped && <span className="ml-3 text-sm text-emerald-700">Đã phát âm thử.</span>}
        </section>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Đang vào phòng thi…" : "Tôi đã sẵn sàng — Bắt đầu"}
        </button>
      </div>
    </main>
  );
}
