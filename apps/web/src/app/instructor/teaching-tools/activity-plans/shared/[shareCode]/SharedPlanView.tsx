"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, BarChart3, Cloud, Users, Clock, PenTool, Copy, UserPlus } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { TOOL_TYPE_LABELS, type PlanTemplateItem } from "../../templates";

type ToolType = PlanTemplateItem["toolType"];

interface SharedPlan {
  id: string;
  title: string;
  ownerName: string;
  items: Array<{ id: string; toolType: ToolType; label: string }>;
}

const TOOL_ICONS: Record<ToolType, typeof Shuffle> = {
  random_picker: Shuffle,
  quick_poll: BarChart3,
  word_cloud: Cloud,
  grouping_tool: Users,
  countdown_timer: Clock,
  whiteboard: PenTool,
};

export default function SharedPlanView({ shareCode }: { shareCode: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<"copy" | "join" | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/shared/${shareCode}`));
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) { toast.error("Không tải được kịch bản"); return; }
      setPlan(await res.json());
    })();
  }, [shareCode]);

  const handleCopy = async () => {
    setBusy("copy");
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/shared/${shareCode}/copy`), {
        method: "POST",
      });
      if (!res.ok) { toast.error("Sao chép thất bại"); return; }
      const copied = await res.json();
      toast.success("Đã sao chép về thư viện của bạn");
      router.push(`/instructor/teaching-tools/activity-plans/${copied.id}`);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    setBusy("join");
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/shared/${shareCode}/join`), {
        method: "POST",
      });
      if (!res.ok) { toast.error("Tham gia thất bại"); return; }
      const data = await res.json();
      toast.success("Đã tham gia đồng biên soạn");
      router.push(`/instructor/teaching-tools/activity-plans/${data.planId}`);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setBusy(null);
    }
  };

  if (notFound) {
    return (
      <div className="rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
        Link không hợp lệ hoặc đã bị thu hồi.
      </div>
    );
  }

  if (!plan) return <p className="text-sm text-muted">Đang tải...</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted">Kịch bản của {plan.ownerName}</p>
        <h1 className="text-2xl font-bold">{plan.title}</h1>
      </div>

      <ul className="space-y-2">
        {plan.items.map((item) => {
          const Icon = TOOL_ICONS[item.toolType];
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 shadow-card"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted">{TOOL_TYPE_LABELS[item.toolType]}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleCopy} disabled={busy !== null} className="btn-primary flex items-center gap-2">
          <Copy size={16} /> {busy === "copy" ? "Đang sao chép..." : "Sao chép về thư viện của tôi"}
        </button>
        <button onClick={handleJoin} disabled={busy !== null} className="btn-secondary flex items-center gap-2">
          <UserPlus size={16} /> {busy === "join" ? "Đang tham gia..." : "Tham gia đồng biên soạn"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Sao chép: tạo bản riêng để sửa thoải mái, không ảnh hưởng bản gốc. Đồng biên soạn: sửa chung bản gốc, đồng bộ real-time với {plan.ownerName}.
      </p>
    </div>
  );
}
