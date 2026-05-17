"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TeachingToolsWrapper from "./TeachingToolsWrapper";
import StudentListGate from "./StudentListGate";
import QuickPoll from "../classroom/QuickPoll";
import WordCloud from "../classroom/WordCloud";
import CountdownTimer from "../classroom/CountdownTimer";
import RandomPicker from "../classroom/RandomPicker";
import GroupingTool from "../classroom/GroupingTool";
import InteractiveBoard from "../classroom/InteractiveBoard";
import type { ToolType } from "./TeachingToolsWrapper";

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

const VALID_TOOLS: ToolType[] = ["poll", "wordcloud", "timer", "random-picker", "grouping", "board"];

export default function TeachingToolsClient({ courses }: TeachingToolsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTool = searchParams.get("tool") as ToolType | null;

  const [selectedTool, setSelectedToolState] = useState<ToolType>(
    initialTool && VALID_TOOLS.includes(initialTool) ? initialTool : null,
  );

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

  if (!selectedTool) {
    return <TeachingToolsWrapper onSelectTool={setSelectedTool} />;
  }

  return (
    <div>
      <button
        onClick={() => setSelectedTool(null)}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
      >
        ← Quay lại
      </button>

      {selectedTool === "poll" && <QuickPoll onExit={() => setSelectedTool(null)} />}
      {selectedTool === "wordcloud" && <WordCloud onExit={() => setSelectedTool(null)} />}
      {selectedTool === "timer" && <CountdownTimer onExit={() => setSelectedTool(null)} />}
      {selectedTool === "board" && <InteractiveBoard onExit={() => setSelectedTool(null)} />}

      {selectedTool === "random-picker" && (
        <StudentListGate
          courses={courses}
          title="Chọn Ngẫu Nhiên — Chọn nguồn sinh viên"
          description="Chọn danh sách sinh viên từ khóa học có sẵn hoặc nhập thủ công để bắt đầu."
        >
          {(list) => (
            <RandomPicker studentList={list} onExit={() => setSelectedTool(null)} />
          )}
        </StudentListGate>
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
    </div>
  );
}
