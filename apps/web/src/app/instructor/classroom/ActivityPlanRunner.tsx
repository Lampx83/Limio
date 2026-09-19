"use client";

import { useState } from "react";
import { ListChecks, Check, ChevronDown, ChevronLeft, Shuffle, BarChart3, Cloud, Users, Clock, PenTool } from "lucide-react";
import RandomPicker from "./RandomPicker";
import QuickPoll from "./QuickPoll";
import WordCloud from "./WordCloud";
import GroupingTool from "./GroupingTool";
import CountdownTimer from "./CountdownTimer";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

type ToolType = "random_picker" | "quick_poll" | "word_cloud" | "grouping_tool" | "countdown_timer" | "whiteboard";

interface PlanItem {
  id: string;
  toolType: ToolType;
  label: string;
  config: Record<string, any> | null;
}

interface PlanSummary {
  id: string;
  title: string;
}

interface PlanWithItems extends PlanSummary {
  items: PlanItem[];
}

const TOOL_ICONS: Record<ToolType, typeof Shuffle> = {
  random_picker: Shuffle,
  quick_poll: BarChart3,
  word_cloud: Cloud,
  grouping_tool: Users,
  countdown_timer: Clock,
  whiteboard: PenTool,
};

interface ActivityPlanRunnerProps {
  // Độc lập với Lesson (thư viện cá nhân) — nhưng CHẠY tool bên dưới vẫn cần
  // 1 nguồn: hoặc lessonId (trang lớp học live), hoặc studentList (trang
  // Công cụ giảng dạy độc lập, chọn nguồn sinh viên qua StudentListGate).
  lessonId?: string;
  studentList?: Array<{ name: string; id: string | null }>;
  // Whiteboard cần fullscreen — mỗi nơi gọi (drawer vs trang độc lập) xử lý
  // khác nhau, nên giao lại cho host quyết định thay vì tự render ở đây.
  onOpenWhiteboard: () => void;
}

/**
 * Phần "Chọn kịch bản" + chạy sự kiện, dùng chung cho cả TeachingToolsDrawer
 * (trong 1 lesson cụ thể) lẫn trang Công cụ giảng dạy độc lập (không cần
 * lesson). Bấm event nào thì tool tương ứng bên dưới điền sẵn config, giáo
 * viên vẫn phải tự bấm nút "Bắt đầu"/"Tạo..." của tool đó.
 */
export default function ActivityPlanRunner({ lessonId, studentList, onOpenWhiteboard }: ActivityPlanRunnerProps) {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanWithItems | null>(null);
  const [ranItemIds, setRanItemIds] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<PlanItem | null>(null);
  const [runSeq, setRunSeq] = useState(0);
  // Chỉ hiện 1 tool đang chạy thay vì cả 5 xếp chồng — đỡ rối. null = chưa
  // chạy event nào (ad-hoc, hiện đủ cả 5 như trước).
  const [focusTool, setFocusTool] = useState<ToolType | null>(null);

  const loadPlans = async () => {
    setShowPlanPicker((v) => !v);
    if (plans !== null) return;
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/activity-plans"));
      if (!res.ok) { toast.error("Không tải được kịch bản"); return; }
      const data = await res.json();
      setPlans(data.plans);
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const selectPlan = async (planId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/activity-plans/${planId}`));
      if (!res.ok) { toast.error("Không tải được kịch bản"); return; }
      const data = await res.json();
      setSelectedPlan(data);
      setRanItemIds(new Set());
      setShowPlanPicker(false);
      setFocusTool(null);
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const runItem = (item: PlanItem) => {
    setRanItemIds((prev) => new Set(prev).add(item.id));
    if (item.toolType === "whiteboard") {
      onOpenWhiteboard();
      return;
    }
    setActiveItem(item);
    setRunSeq((s) => s + 1);
    setFocusTool(item.toolType);
    requestAnimationFrame(() => {
      document.getElementById(`tool-${item.toolType}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const cfgFor = (toolType: ToolType) => (activeItem?.toolType === toolType ? activeItem.config ?? {} : {});
  const keyFor = (toolType: ToolType) => (activeItem?.toolType === toolType ? `${activeItem.id}-${runSeq}` : `default-${toolType}`);
  const visible = (toolType: ToolType) => focusTool === null || focusTool === toolType;

  // Hướng dẫn cho học viên — soạn sẵn ở form event (mọi loại tool đều có),
  // hiện ngay phía trên tool đang chạy để chiếu lên màn hình cùng lúc.
  const InstructionBanner = ({ toolType }: { toolType: ToolType }) => {
    const notes = cfgFor(toolType).notes as string | undefined;
    if (!notes) return null;
    return (
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
        {notes}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-900/10">
        <button onClick={loadPlans} className="flex w-full items-center gap-3 p-4 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <ListChecks size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
              {selectedPlan ? selectedPlan.title : "Chọn kịch bản"}
            </p>
            <p className="text-xs text-muted">
              {selectedPlan ? `${selectedPlan.items.length} event — chạy tuỳ ý` : "Chạy chuỗi event đã soạn sẵn"}
            </p>
          </div>
          <ChevronDown size={16} className={`shrink-0 transition-transform ${showPlanPicker ? "rotate-180" : ""}`} />
        </button>

        {showPlanPicker && (
          <div className="border-t border-brand-200 p-3 dark:border-brand-900/40">
            {plans === null ? (
              <p className="px-1 py-1 text-xs text-muted">Đang tải...</p>
            ) : plans.length === 0 ? (
              <p className="px-1 py-1 text-xs text-muted">
                Chưa có kịch bản nào — soạn ở "Công cụ giảng dạy → Kịch bản lớp học".
              </p>
            ) : (
              <ul className="space-y-1">
                {plans.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => selectPlan(p.id)}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white dark:hover:bg-black/20"
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selectedPlan && selectedPlan.items.length > 0 && (
          <ul className="space-y-1.5 border-t border-brand-200 p-3 dark:border-brand-900/40">
            {selectedPlan.items.map((item) => {
              const Icon = TOOL_ICONS[item.toolType];
              const ran = ranItemIds.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => runItem(item)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-token bg-white px-2.5 py-2 text-left text-sm transition hover:border-brand-400 dark:bg-[rgb(var(--surface))]"
                  >
                    <Icon size={14} className="shrink-0 text-brand-600" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {ran && <Check size={14} className="shrink-0 text-green-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {focusTool !== null && (
        <button
          onClick={() => setFocusTool(null)}
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <ChevronLeft size={16} /> Xem tất cả công cụ
        </button>
      )}

      {visible("random_picker") && (
        <div id="tool-random_picker">
          <InstructionBanner toolType="random_picker" />
          <RandomPicker lessonId={lessonId} studentList={studentList} />
        </div>
      )}
      {visible("quick_poll") && (
        <div id="tool-quick_poll">
          <InstructionBanner toolType="quick_poll" />
          <QuickPoll
            key={keyFor("quick_poll")}
            lessonId={lessonId}
            studentList={studentList}
            initialQuestion={cfgFor("quick_poll").question}
            initialOptions={cfgFor("quick_poll").options}
          />
        </div>
      )}
      {visible("word_cloud") && (
        <div id="tool-word_cloud">
          <InstructionBanner toolType="word_cloud" />
          <WordCloud
            key={keyFor("word_cloud")}
            lessonId={lessonId}
            studentList={studentList}
            initialPrompt={cfgFor("word_cloud").prompt}
          />
        </div>
      )}
      {visible("grouping_tool") && (
        <div id="tool-grouping_tool">
          <InstructionBanner toolType="grouping_tool" />
          <GroupingTool
            key={keyFor("grouping_tool")}
            lessonId={lessonId}
            studentList={studentList}
            initialMode={cfgFor("grouping_tool").mode}
            initialGroupSize={cfgFor("grouping_tool").groupSize}
            initialNumGroups={cfgFor("grouping_tool").numGroups}
          />
        </div>
      )}
      {visible("countdown_timer") && (
        <div id="tool-countdown_timer">
          <InstructionBanner toolType="countdown_timer" />
          <CountdownTimer key={keyFor("countdown_timer")} initialMinutes={cfgFor("countdown_timer").minutes} />
        </div>
      )}
    </div>
  );
}
