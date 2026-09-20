"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StudentListGate from "./StudentListGate";
import QuickPoll from "../classroom/QuickPoll";
import WordCloud from "../classroom/WordCloud";
import CountdownTimer from "../classroom/CountdownTimer";
import RandomPicker, { type PickerTemplate } from "../classroom/RandomPicker";
import GroupingTool from "../classroom/GroupingTool";
import InteractiveBoard from "../classroom/InteractiveBoard";
import Whiteboard from "../classroom/Whiteboard";
import ActivityPlanRunner from "../classroom/ActivityPlanRunner";

export type ToolType =
  | "poll"
  | "wordcloud"
  | "timer"
  | "random-picker"
  | "grouping"
  | "board"
  | "whiteboard"
  | "run-plan"
  | null;

export interface StudentItem {
  name: string;
  id: string | null;
}

interface Course {
  id: string;
  title: string;
  _count: { enrollments: number };
}

interface TeachingToolsClientProps {
  courses: Course[];
}

const VALID_TOOLS: ToolType[] = [
  "poll",
  "wordcloud",
  "timer",
  "random-picker",
  "grouping",
  "board",
  "whiteboard",
  "run-plan",
];

export default function TeachingToolsClient({ courses }: TeachingToolsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTool = searchParams.get("tool") as ToolType | null;

  const [selectedTool, setSelectedToolState] = useState<ToolType>(
    initialTool && VALID_TOOLS.includes(initialTool) ? initialTool : null,
  );

  // Bước 1 của "Chọn Ngẫu Nhiên": chọn kiểu quay trước, rồi mới tới nhập danh sách.
  const [pickerTemplate, setPickerTemplate] = useState<PickerTemplate | null>(null);

  // Chọn công cụ từ menu trái (đổi ?tool= trên URL khi trang đã mở) → đồng bộ lại state.
  useEffect(() => {
    const t = searchParams.get("tool") as ToolType | null;
    setSelectedToolState(t && VALID_TOOLS.includes(t) ? t : null);
    if (t !== "random-picker") setPickerTemplate(null);
  }, [searchParams]);

  const setSelectedTool = useCallback(
    (tool: ToolType) => {
      setSelectedToolState(tool);
      const params = new URLSearchParams();
      if (tool) params.set("tool", tool);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router],
  );

  // Không còn màn hình lưới chọn công cụ: chưa chọn gì thì vào công cụ đầu tiên.
  useEffect(() => {
    if (!selectedTool) setSelectedTool("poll");
  }, [selectedTool, setSelectedTool]);

  if (!selectedTool) return null;

  return (
    <div>
      {/* Bảng tương tác tự mở full-screen ngay khi có phiên (xem InteractiveBoard.tsx)
          và có sẵn nút thoát riêng trong header của nó — không cần "← Quay lại" ở đây
          nữa, tránh 2 nút exit cùng hiển thị. */}
      {selectedTool !== "board" && selectedTool !== "whiteboard" && selectedTool !== "random-picker" && (
        <button
          onClick={() => setSelectedTool(null)}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          ← Quay lại
        </button>
      )}

      {selectedTool === "poll" && <QuickPoll onExit={() => setSelectedTool(null)} />}
      {selectedTool === "wordcloud" && <WordCloud onExit={() => setSelectedTool(null)} />}
      {selectedTool === "timer" && <CountdownTimer onExit={() => setSelectedTool(null)} />}
      {selectedTool === "board" && <InteractiveBoard onExit={() => setSelectedTool(null)} />}
      {selectedTool === "whiteboard" && <Whiteboard onExit={() => setSelectedTool(null)} />}

      {selectedTool === "random-picker" && (
        pickerTemplate === null ? (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-h2">Chọn Ngẫu Nhiên — Chọn kiểu quay</h2>
            <p className="mt-1 text-body text-muted">Chọn hiệu ứng gọi tên, sau đó bạn sẽ nhập danh sách sinh viên.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {([
                ["wheel", "🎡", "Vòng quay may mắn", "Wheel of Names — tên chia thành các múi, kim chỉ vào người trúng."],
                ["slot", "🎰", "Thanh quay casino", "Máy quay dọc kiểu slot — tên chạy nhanh rồi dừng lại."],
              ] as const).map(([key, icon, label, desc]) => (
                <button
                  key={key}
                  onClick={() => setPickerTemplate(key)}
                  className="rounded-2xl border border-token bg-white p-6 text-left transition hover:border-brand-500 hover:shadow-md"
                >
                  <span className="text-5xl">{icon}</span>
                  <span className="mt-3 block text-h4 font-semibold">{label}</span>
                  <span className="mt-1 block text-meta text-muted">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <StudentListGate
            courses={courses}
            title="Chọn Ngẫu Nhiên — Chọn nguồn sinh viên"
            description="Chọn danh sách sinh viên từ khóa học có sẵn hoặc nhập thủ công để bắt đầu."
          >
            {(list) => (
              <RandomPicker
                studentList={list}
                initialTemplate={pickerTemplate}
                onExit={() => {
                  setPickerTemplate(null);
                  setSelectedTool(null);
                }}
              />
            )}
          </StudentListGate>
        )
      )}

      {selectedTool === "grouping" && (
        <StudentListGate
          courses={courses}
          title="Phân Nhóm — Chọn nguồn sinh viên"
          description="Chọn danh sách sinh viên từ khóa học có sẵn hoặc nhập thủ công để bắt đầu chia nhóm."
        >
          {(list) => (
            <GroupingTool studentList={list} onExit={() => setSelectedTool(null)} />
          )}
        </StudentListGate>
      )}

      {selectedTool === "run-plan" && (
        <StudentListGate
          courses={courses}
          title="Chạy kịch bản — Chọn nguồn sinh viên"
          description="Chọn danh sách sinh viên từ khóa học có sẵn hoặc nhập thủ công, rồi chọn kịch bản muốn chạy."
        >
          {(list) => (
            <ActivityPlanRunner
              studentList={list}
              onOpenWhiteboard={() => setSelectedTool("whiteboard")}
            />
          )}
        </StudentListGate>
      )}
    </div>
  );
}
