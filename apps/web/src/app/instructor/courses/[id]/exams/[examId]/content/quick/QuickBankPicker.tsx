"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

type Bank = { id: string; name: string };

interface PreviewQuestion {
  id: string;
  code: string | null;
  prompt: string;
  type: string;
  difficulty: number;
  topic: string | null;
}

/**
 * "Chọn nhanh theo tiêu chí" — phía sau vẫn tạo 1 ExamSection
 * (selectionMode=random_from_bank) như trước, chỉ giờ đứng riêng 1 trang thay
 * vì 1 tab trong modal. Section tạo dở mà rời trang giữa chừng (điều hướng
 * trong app) sẽ bị xoá lại qua cleanup lúc unmount — không để rác.
 */
export default function QuickBankPicker({ examId, doneHref }: { examId: string; doneHref: string }) {
  const router = useRouter();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState("");
  useEffect(() => {
    fetch("/api/question-banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { banks: Bank[] } | null) => {
        if (!j) return;
        setBanks(j.banks);
        if (j.banks.length === 1) setBankId(j.banks[0]!.id);
      });
  }, []);

  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(10);
  const [difficulties, setDifficulties] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sectionId, setSectionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    totalRequested: number;
    totalSampled: number;
    questions: PreviewQuestion[];
  } | null>(null);
  const [reshuffleSeed, setReshuffleSeed] = useState<string | null>(null);

  useEffect(() => {
    if (!bankId) {
      setTopics([]);
      setSelectedTopics(new Set());
      return;
    }
    fetch(`/api/question-banks/${bankId}/topics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { topics: string[] } | null) => {
        const t = j?.topics ?? [];
        setTopics(t);
        // Mặc định chọn hết — người dùng bỏ bớt thay vì phải tự thêm từng chủ
        // đề, đỡ 1 bước thao tác cho trường hợp phổ biến "lấy khắp mọi chủ đề".
        setSelectedTopics(new Set(t));
      });
  }, [bankId]);

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  // Rời trang giữa chừng (chưa chốt) → xoá section nháp, không để rác trong
  // "Chia đề thành nhiều phần". Dùng ref để cleanup luôn thấy sectionId mới
  // nhất dù effect chỉ đăng ký 1 lần lúc mount.
  const sectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sectionIdRef.current = sectionId;
  }, [sectionId]);
  useEffect(() => {
    return () => {
      if (sectionIdRef.current) {
        fetch(`/api/exam-sections/${sectionIdRef.current}`, { method: "DELETE" }).catch(
          () => undefined,
        );
      }
    };
  }, []);

  const loadPreview = async (id: string, seed?: string | null) => {
    const url = seed
      ? `/api/exams/${examId}/sections/${id}/preview-pool?reshuffle=${encodeURIComponent(seed)}`
      : `/api/exams/${examId}/sections/${id}/preview-pool`;
    const r = await fetch(url);
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    setPreview(await r.json());
  };

  // Chưa chọn chủ đề nào: lọc độ khó ở top-level poolFilter.difficulty
  // (sampler tự chia đều theo mức). Có ≥1 chủ đề (mặc định là tất cả): mỗi tổ
  // hợp (chủ đề × mức độ khó đã chọn) thành 1 bucket, chia đều count cho các
  // tổ hợp — đảm bảo câu hỏi trải đều các chủ đề đã chọn thay vì random tự do.
  const buildPoolFilter = () => {
    if (selectedTopics.size === 0) {
      return {
        bankIds: [bankId],
        count,
        ...(difficulties.size > 0 ? { difficulty: [...difficulties] } : {}),
      };
    }
    const topicList = [...selectedTopics];
    const levels = difficulties.size > 0 ? [...difficulties].sort((a, b) => a - b) : [null];
    const combos = topicList.flatMap((t) => levels.map((level) => ({ topic: t, level })));
    const base = Math.floor(count / combos.length);
    const remainder = count - base * combos.length;
    const buckets = combos
      .map(({ topic, level }, i) => ({
        topic,
        ...(level !== null ? { difficulty: level } : {}),
        count: base + (i < remainder ? 1 : 0),
      }))
      .filter((b) => b.count > 0);
    return { bankIds: [bankId], count, buckets };
  };

  const onXemTruoc = async () => {
    if (!bankId) {
      setErr("Chọn ngân hàng câu hỏi trước");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Rút ngẫu nhiên từ ngân hàng",
          selectionMode: "random_from_bank",
          resolutionMode: "per_publish",
          poolFilter: buildPoolFilter(),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const { id } = (await r.json()) as { id: string };
      setSectionId(id);
      await loadPreview(id);
    } finally {
      setBusy(false);
    }
  };

  const onXemBoKhac = async () => {
    if (!sectionId) return;
    const seed = `${Math.random()}`;
    setReshuffleSeed(seed);
    await loadPreview(sectionId, seed);
  };

  const onChot = async () => {
    if (!sectionId) return;
    setBusy(true);
    setErr(null);
    try {
      const body = reshuffleSeed ? { reshuffleSeed } : {};
      const r = await fetch(`/api/exams/${examId}/sections/${sectionId}/import-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      window.dispatchEvent(new Event("fbm:exam-sections-changed"));
      sectionIdRef.current = null; // đã chốt — cleanup-on-unmount khỏi xoá nhầm
      router.push(doneHref);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleDifficulty = (n: number) => {
    setDifficulties((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  return (
    <div className="mt-6 flex max-w-2xl flex-col gap-5">
      {!preview && (
        <>
          {banks.length > 1 && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-faint">
                Ngân hàng câu hỏi
              </span>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="w-full rounded-lg border border-default bg-white px-4 py-2.5 text-sm font-medium"
              >
                <option value="">Chọn ngân hàng...</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="rounded-xl border border-default bg-white p-6">
            <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-faint">
              Số lượng câu
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-default text-faint hover:bg-slate-50"
                aria-label="Giảm"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-default px-2 py-2 text-center text-base font-semibold"
              />
              <button
                type="button"
                onClick={() => setCount((c) => Math.min(200, c + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-default text-faint hover:bg-slate-50"
                aria-label="Tăng"
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-sm text-faint">
                câu — có thể chỉnh lại sau khi thêm vào đề.
              </span>
            </div>
          </div>

          {topics.length > 0 && (
            <div className="rounded-xl border border-default bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Chủ đề</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTopics((prev) => (prev.size === topics.length ? new Set() : new Set(topics)))
                  }
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  {selectedTopics.size === topics.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
              </div>
              <div className="mt-2.5 overflow-hidden rounded-lg border border-default">
                <div className="flex items-center justify-between border-b border-default bg-slate-50 px-3.5 py-2 text-xs text-faint">
                  <span>
                    {selectedTopics.size}/{topics.length} chủ đề đã chọn
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-2 p-2 sm:grid-cols-2">
                  {topics.map((t) => (
                    <label key={t} className="flex items-center gap-2.5 px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTopics.has(t)}
                        onChange={() => toggleTopic(t)}
                        className="h-[18px] w-[18px] shrink-0 accent-brand-600"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-default bg-white p-6">
            <span className="mb-3 block text-base font-semibold">Độ khó</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = difficulties.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleDifficulty(n)}
                    className={`h-9 w-9 rounded-full border text-sm font-semibold ${
                      on
                        ? "border-brand-500 bg-brand-600 text-white"
                        : "border-default bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-xs text-faint">Bỏ trống = lấy đủ mọi mức độ khó.</p>
          </div>

          {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>}

          <div className="flex items-center justify-between gap-4 border-t border-default pt-5">
            <p className="text-sm text-faint">
              Hệ thống lấy ngẫu nhiên số câu ở trên rồi cố định lại cho cả lớp — mọi học sinh làm
              chung bộ câu này.
            </p>
            <button
              type="button"
              onClick={() => void onXemTruoc()}
              disabled={busy || !bankId}
              className="shrink-0 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Đang bốc…" : "Xem trước"}
            </button>
          </div>
        </>
      )}

      {preview && (
        <div className="rounded-xl border border-default bg-white p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              Đã bốc được <strong className="tabular-nums text-slate-900">{preview.totalSampled}</strong> /{" "}
              {preview.totalRequested} câu
              {preview.totalSampled < preview.totalRequested && (
                <span className="ml-2 text-amber-700">
                  ⚠ thiếu {preview.totalRequested - preview.totalSampled} — ngân hàng chưa đủ câu đã
                  publish
                </span>
              )}
            </span>
            <button
              onClick={() => void onXemBoKhac()}
              className="rounded border border-default px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              🎲 Xem bộ khác
            </button>
          </div>

          <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto rounded border border-default p-2">
            {preview.questions.map((qq, idx) => (
              <li key={qq.id} className="flex items-start gap-2 rounded bg-slate-50 px-2 py-1.5 text-xs">
                <span className="shrink-0 text-faint">{idx + 1}.</span>
                {qq.code && (
                  <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                    {qq.code}
                  </span>
                )}
                <span className="line-clamp-1 flex-1 text-slate-800">{qq.prompt}</span>
                <span className="shrink-0 text-faint">✦{qq.difficulty}/5</span>
              </li>
            ))}
          </ul>

          {err && <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void onChot()}
              disabled={busy || preview.totalSampled === 0}
              className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Đang thêm…" : `Thêm ${preview.totalSampled} câu này vào đề`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
