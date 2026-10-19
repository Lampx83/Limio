"use client";

import { useState } from "react";
import type { LibraryItem, LibraryPage } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import PracticeRow from "./PracticeRow";

/**
 * LANG L6.2 — danh sách đề của thư viện: trang đầu do máy chủ dựng sẵn, "Tải thêm" lấy trang kế bằng con trỏ
 * (30 đề/lần) và NỐI vào danh sách; bộ lọc nằm trong URL nên đổi bộ lọc là một trang mới.
 */
export default function PracticeLibraryList({
  slug,
  courseId,
  initial,
  queryString,
}: {
  slug: string;
  courseId: string;
  initial: LibraryPage;
  /** Bộ lọc hiện tại (không gồm cursor), để lấy trang kế đúng bộ lọc. */
  queryString: string;
}) {
  const [items, setItems] = useState<LibraryItem[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams(queryString);
      qs.set("cursor", cursor);
      const res = await fetch(apiUrl(`/api/courses/${courseId}/practice-library?${qs.toString()}`));
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as LibraryPage;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.examId));
        return [...prev, ...page.items.filter((i) => !seen.has(i.examId))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError("Chưa tải thêm được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]" aria-label="Danh sách đề">
        {items.map((it) => (
          <PracticeRow key={it.examId} slug={slug} item={it} />
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-meta" aria-live="polite">
          Đang hiện {items.length}/{initial.total} đề
        </p>
        {cursor && (
          <button type="button" onClick={() => void more()} disabled={busy} className="btn-secondary btn-sm">
            {busy ? "Đang tải…" : "Tải thêm"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="banner-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
