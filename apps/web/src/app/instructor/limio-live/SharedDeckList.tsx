"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Presentation, Users } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate } from "@/lib/datetime";

interface SharedDeck {
  id: string;
  title: string;
  slideCount: number;
  updatedAt: string;
  ownerName: string;
}

/**
 * "Được chia sẻ với tôi" (docs/tieu-chi/dong-giang-vien-bai-giang.md, AC3): bài giảng người khác thêm mình làm đồng giảng viên.
 * Không có bài nào thì không hiện gì, để trang của người chưa được chia sẻ không thêm một mục trống.
 */
export default function SharedDeckList() {
  const [decks, setDecks] = useState<SharedDeck[]>([]);

  useEffect(() => {
    void (async () => {
      const r = await fetch(apiUrl("/api/instructor/limio-live/shared-decks"), { cache: "no-store" }).catch(() => null);
      if (r?.ok) setDecks(((await r.json()) as { decks: SharedDeck[] }).decks);
    })();
  }, []);

  if (decks.length === 0) return null;

  return (
    <section aria-labelledby="shared-decks-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-muted" aria-hidden="true" />
        <h2 id="shared-decks-title" className="text-h3">
          Được chia sẻ với tôi
        </h2>
        <span className="chip">{decks.length}</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((d) => (
          <li key={d.id} className="flex items-start gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-700" aria-hidden="true">
              <Presentation size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/instructor/limio-live/${d.id}`} className="block truncate font-semibold hover:underline" prefetch={false}>
                {d.title}
              </Link>
              <p className="text-meta text-muted">
                {d.slideCount} slide · {formatDate(d.updatedAt)}
              </p>
              <p className="truncate text-meta text-muted">Của {d.ownerName} · bạn là đồng giảng viên</p>
              <div className="mt-2 flex gap-2">
                <Link href={`/instructor/limio-live/${d.id}`} className="btn-secondary btn-sm" prefetch={false}>
                  Mở
                </Link>
                <Link href={`/instructor/limio-live/${d.id}/present?from=start`} className="btn-ghost btn-sm" prefetch={false}>
                  Trình chiếu
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
