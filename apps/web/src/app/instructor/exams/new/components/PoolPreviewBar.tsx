"use client";

import { useEffect, useState, useRef } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { BloomMix, DifficultyProfile } from "../useWizardState";

interface Props {
  courseId: string;
  lessonIds: string[];
  questionCount: number;
  bloomMix: BloomMix;
  difficultyProfile: DifficultyProfile;
  disabled?: boolean;
}

interface PreviewResult {
  totalRequested: number;
  totalAvailable: number;
  emptyScope: boolean;
  fallbackUsed: boolean;
  deficits: { cognitiveLevel: string; difficulty: number; count: number; available: number; deficit: number }[];
}

export default function PoolPreviewBar({
  courseId, lessonIds, questionCount, bloomMix, difficultyProfile, disabled,
}: Props) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled || lessonIds.length === 0) {
      setResult(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/exams/preview-pool", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            courseId,
            lessonIds,
            questionCount,
            bloomMix,
            difficultyProfile,
            distributionMode: "single", // scope preview only cares about pool, not distribution
            autoEquating: true,
          }),
        });
        if (res.ok) setResult(await res.json());
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [courseId, lessonIds, questionCount, bloomMix, difficultyProfile, disabled]);

  if (lessonIds.length === 0) return null;

  if (loading || !result) {
    return <p className="text-xs text-faint animate-pulse">Đang kiểm tra ngân hàng câu hỏi…</p>;
  }

  if (result.emptyScope) {
    return (
      <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
        Các bài học đã chọn chưa có câu hỏi trong ngân hàng hoặc chưa được gắn kỹ năng.{" "}
        <a href="/instructor/question-banks" className="underline">Thêm câu hỏi</a>
      </div>
    );
  }

  const enough = result.totalAvailable >= result.totalRequested;
  return (
    <div className={`rounded border px-3 py-2 text-xs ${enough ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      {enough ? (
        <span className="inline-flex items-center gap-1.5"><CheckCircle className="h-4 w-4 shrink-0" /> Ngân hàng có đủ câu hỏi cho đề này ({result.totalAvailable} câu).</span>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 shrink-0" /> Ngân hàng chỉ có <strong>{result.totalAvailable}</strong>/{result.totalRequested} câu phù hợp.</span>
          {result.fallbackUsed && (
            <span className="ml-2">Lớp chưa có dữ liệu học tập — dùng cấu hình Đánh giá toàn diện.</span>
          )}
          {result.deficits.length > 0 && (
            <ul className="mt-1 ml-2 list-disc space-y-0.5">
              {result.deficits.map((d, i) => (
                <li key={i}>
                  Mức <strong>{bloomLabel(d.cognitiveLevel)}</strong>, độ khó {d.difficulty}: cần {d.count}, có {d.available}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function bloomLabel(cl: string) {
  if (cl === "remember_understand") return "Nhớ & Hiểu";
  if (cl === "apply") return "Vận dụng";
  return "Phân tích";
}
