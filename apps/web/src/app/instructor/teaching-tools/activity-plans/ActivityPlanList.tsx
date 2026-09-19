"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, Sparkles, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/datetime";
import { PLAN_TEMPLATES, type PlanTemplate, type DeliveryMode } from "./templates";

interface PlanSummary {
  id: string;
  title: string;
  updatedAt: string;
  isOwner: boolean;
  _count: { items: number };
}

export default function ActivityPlanList() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [busyTemplateKey, setBusyTemplateKey] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<"all" | DeliveryMode>("all");

  const load = async () => {
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/activity-plans"));
      if (!res.ok) { toast.error("Không tải được danh sách kịch bản"); return; }
      const data = await res.json();
      setPlans(data.plans);
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) { toast.error("Nhập tên kịch bản"); return; }
    setIsCreating(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/activity-plans"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) { toast.error("Tạo kịch bản thất bại"); return; }
      const plan = await res.json();
      router.push(`/instructor/teaching-tools/activity-plans/${plan.id}`);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUseTemplate = async (tpl: PlanTemplate) => {
    setBusyTemplateKey(tpl.key);
    try {
      const planRes = await fetch(apiUrl("/api/instructor/teaching-tools/activity-plans"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: tpl.name }),
      });
      if (!planRes.ok) { toast.error("Tạo kịch bản thất bại"); return; }
      const plan = await planRes.json();

      for (const item of tpl.items) {
        await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${plan.id}/items`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolType: item.toolType,
            label: item.label,
            config: item.config,
          }),
        });
      }

      router.push(`/instructor/teaching-tools/activity-plans/${plan.id}`);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setBusyTemplateKey(null);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Xoá kịch bản này? Không thể hoàn tác.")) return;
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}`),
        { method: "DELETE" }
      );
      if (!res.ok) { toast.error("Xoá thất bại"); return; }
      setPlans((prev) => prev?.filter((p) => p.id !== planId) ?? null);
      toast.success("Đã xoá");
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const visibleTemplates = PLAN_TEMPLATES.filter(
    (t) => modeFilter === "all" || t.mode === "both" || t.mode === modeFilter
  );
  const fullTemplates = visibleTemplates.filter((t) => t.category === "full");
  const warmupTemplates = visibleTemplates.filter((t) => t.category === "warmup");

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-sm font-medium">Tạo kịch bản mới</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Vd: Ôn tập chương 3"
              className="input w-full"
            />
          </div>
          <button onClick={handleCreate} disabled={isCreating} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Tạo trống
          </button>
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className="btn-secondary flex items-center gap-2"
          >
            <Sparkles size={16} /> Bắt đầu từ mẫu
          </button>
        </div>

        {showTemplates && (
          <div className="mt-5 space-y-5 border-t border-token pt-5">
            <div className="inline-flex rounded-lg border border-token p-0.5">
              {(
                [
                  ["all", "Tất cả"],
                  ["in_person", "Dạy trực tiếp"],
                  ["online", "Dạy trực tuyến"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setModeFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    modeFilter === value ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30" : ""
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Mẫu cho cả tiết
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {fullTemplates.map((tpl) => (
                  <TemplateCard key={tpl.key} tpl={tpl} busy={busyTemplateKey === tpl.key} onUse={handleUseTemplate} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Mẫu khởi động đầu giờ
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {warmupTemplates.map((tpl) => (
                  <TemplateCard key={tpl.key} tpl={tpl} busy={busyTemplateKey === tpl.key} onUse={handleUseTemplate} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {plans === null ? (
        <p className="text-sm text-muted">Đang tải...</p>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
          Chưa có kịch bản nào — tạo trống hoặc bắt đầu từ mẫu ở trên.
        </div>
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card"
            >
              <Link
                href={`/instructor/teaching-tools/activity-plans/${plan.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  <ListChecks size={18} />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {plan.title}
                    {!plan.isOwner && (
                      <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        Đồng biên soạn
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {plan._count.items} event · cập nhật {formatDateTime(plan.updatedAt)}
                  </p>
                </div>
              </Link>
              {plan.isOwner && (
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="btn-icon btn-danger shrink-0"
                  title="Xoá kịch bản"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateCard({
  tpl,
  busy,
  onUse,
}: {
  tpl: PlanTemplate;
  busy: boolean;
  onUse: (tpl: PlanTemplate) => void;
}) {
  return (
    <button
      onClick={() => onUse(tpl)}
      disabled={busy}
      className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3 text-left transition hover:border-brand-400 disabled:opacity-50"
    >
      <p className="text-sm font-semibold">{tpl.name}</p>
      <p className="mt-0.5 text-xs text-muted">{tpl.source}</p>
      <p className="mt-1 text-xs text-faint">{tpl.items.length} event</p>
    </button>
  );
}
