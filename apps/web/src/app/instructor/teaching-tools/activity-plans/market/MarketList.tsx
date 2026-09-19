"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Heart, Copy, ListChecks } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

interface MarketPlan {
  id: string;
  title: string;
  ownerName: string;
  itemCount: number;
  likeCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
}

export default function MarketList() {
  const router = useRouter();
  const [plans, setPlans] = useState<MarketPlan[] | null>(null);
  const [onlySaved, setOnlySaved] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const load = async (savedOnly: boolean) => {
    setPlans(null);
    const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/market${savedOnly ? "?saved=1" : ""}`));
    if (!res.ok) { toast.error("Không tải được chợ kịch bản"); return; }
    const data = await res.json();
    setPlans(data.plans);
  };

  useEffect(() => {
    load(onlySaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlySaved]);

  const toggleLike = async (plan: MarketPlan) => {
    setPlans((prev) =>
      prev?.map((p) =>
        p.id === plan.id
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p
      ) ?? null
    );
    const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/like`), { method: "POST" });
    if (!res.ok) { toast.error("Thao tác thất bại"); load(onlySaved); }
  };

  const toggleSave = async (plan: MarketPlan) => {
    setPlans((prev) =>
      prev?.map((p) => (p.id === plan.id ? { ...p, savedByMe: !p.savedByMe } : p)) ?? null
    );
    const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/save`), { method: "POST" });
    if (!res.ok) { toast.error("Thao tác thất bại"); load(onlySaved); }
  };

  const handleCopy = async (plan: MarketPlan) => {
    setCopyingId(plan.id);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/copy`), { method: "POST" });
      if (!res.ok) { toast.error("Sao chép thất bại"); return; }
      const copied = await res.json();
      toast.success("Đã sao chép về thư viện của bạn");
      router.push(`/instructor/teaching-tools/activity-plans/${copied.id}`);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-token p-0.5">
        <button
          onClick={() => setOnlySaved(false)}
          className={`rounded-md px-3 py-1.5 text-sm ${!onlySaved ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30" : ""}`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setOnlySaved(true)}
          className={`rounded-md px-3 py-1.5 text-sm ${onlySaved ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30" : ""}`}
        >
          Đã lưu
        </button>
      </div>

      {plans === null ? (
        <p className="text-sm text-muted">Đang tải...</p>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
          {onlySaved ? "Chưa lưu kịch bản nào." : "Chưa có kịch bản công khai nào."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.id} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  <ListChecks size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{plan.title}</p>
                  <p className="text-xs text-muted">{plan.ownerName} · {plan.itemCount} event</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <button
                  onClick={() => toggleSave(plan)}
                  title="Lưu xem sau"
                  className={`btn-icon btn-sm ${plan.savedByMe ? "text-brand-600" : ""}`}
                >
                  <Bookmark size={15} fill={plan.savedByMe ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => toggleLike(plan)}
                  title="Thích"
                  className={`btn-icon btn-sm flex items-center gap-1 ${plan.likedByMe ? "text-pink-600" : ""}`}
                >
                  <Heart size={15} fill={plan.likedByMe ? "currentColor" : "none"} />
                  <span className="text-xs">{plan.likeCount}</span>
                </button>
                <button
                  onClick={() => handleCopy(plan)}
                  disabled={copyingId === plan.id}
                  title="Sao chép về thư viện của tôi"
                  className="btn-icon btn-sm ml-auto"
                >
                  <Copy size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
