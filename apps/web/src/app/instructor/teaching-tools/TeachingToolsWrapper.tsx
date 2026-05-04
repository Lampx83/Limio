"use client";

import { useState } from "react";
import { BarChart3, Cloud, Clock, Users, Shuffle } from "lucide-react";
import QuickPoll from "../classroom/QuickPoll";
import WordCloud from "../classroom/WordCloud";
import CountdownTimer from "../classroom/CountdownTimer";
import RandomPicker from "../classroom/RandomPicker";
import GroupingTool from "../classroom/GroupingTool";
import type { StudentItem } from "./TeachingToolsClient";

type ToolType = "poll" | "wordcloud" | "timer" | "random-picker" | "grouping" | null;

interface TeachingToolsWrapperProps {
  studentList: StudentItem[];
}

const TOOLS = [
  {
    id: "poll",
    icon: BarChart3,
    label: "Quick Poll",
    description: "Tạo poll trắc nghiệm nhanh",
    color: "text-blue-600",
    category: "standalone",
  },
  {
    id: "wordcloud",
    icon: Cloud,
    label: "Word Cloud",
    description: "Thu thập đáp án dạng từ",
    color: "text-purple-600",
    category: "standalone",
  },
  {
    id: "timer",
    icon: Clock,
    label: "Đếm Ngược",
    description: "Bộ đếm ngược thời gian",
    color: "text-orange-600",
    category: "standalone",
  },
  {
    id: "random-picker",
    icon: Shuffle,
    label: "Chọn Ngẫu Nhiên",
    description: "Chọn ngẫu nhiên sinh viên",
    color: "text-green-600",
    category: "student-list",
  },
  {
    id: "grouping",
    icon: Users,
    label: "Phân Nhóm",
    description: "Chia lớp thành các nhóm",
    color: "text-pink-600",
    category: "student-list",
  },
];

export default function TeachingToolsWrapper({
  studentList,
}: TeachingToolsWrapperProps) {
  const [selectedTool, setSelectedTool] = useState<ToolType>(null);

  if (selectedTool) {
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
        {selectedTool === "random-picker" && (
          studentList.length > 0 ? (
            <RandomPicker studentList={studentList} onExit={() => setSelectedTool(null)} />
          ) : (
            <div className="rounded-2xl border-2 border-accent-200 bg-[rgb(var(--surface))] p-6 shadow-card text-center">
              <p className="text-muted">Vui lòng chọn khóa học hoặc nhập danh sách sinh viên trước</p>
            </div>
          )
        )}
        {selectedTool === "grouping" && (
          studentList.length > 0 ? (
            <GroupingTool studentList={studentList} onExit={() => setSelectedTool(null)} />
          ) : (
            <div className="rounded-2xl border-2 border-accent-200 bg-[rgb(var(--surface))] p-6 shadow-card text-center">
              <p className="text-muted">Vui lòng chọn khóa học hoặc nhập danh sách sinh viên trước</p>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold mb-4">Công cụ không cần danh sách sinh viên</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.filter((t) => t.category === "standalone").map((tool) => {
            const IconComponent = tool.icon;

            return (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id as ToolType)}
                className="group relative overflow-hidden rounded-xl border-2 border-accent-200 bg-gradient-to-br from-accent-50 to-accent-100/50 p-6 transition-all duration-300 hover:border-accent-400 hover:shadow-lg dark:border-accent-800 dark:from-accent-900/20 dark:to-accent-800/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent-200/0 opacity-0 transition-opacity duration-300 group-hover:opacity-10" />

                <div className="relative space-y-3 text-center">
                  <div className={`flex justify-center ${tool.color}`}>
                    <IconComponent size={56} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {tool.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {tool.description}
                  </p>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="text-center">
                    <div className="inline-block rounded-full bg-brand-600 px-4 py-2 text-white font-semibold text-sm">
                      Mở
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Công cụ cần danh sách sinh viên</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.filter((t) => t.category === "student-list").map((tool) => {
            const IconComponent = tool.icon;
            const isDisabled = studentList.length === 0;

            return (
              <button
                key={tool.id}
                onClick={() => !isDisabled && setSelectedTool(tool.id as ToolType)}
                disabled={isDisabled}
                className={`group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300 ${
                  isDisabled
                    ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-800 dark:bg-gray-900/20"
                    : "border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/50 hover:border-brand-400 hover:shadow-lg dark:border-brand-800 dark:from-brand-900/20 dark:to-brand-800/10"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-brand-200/0 opacity-0 transition-opacity duration-300 group-hover:opacity-10" />

                <div className="relative space-y-3 text-center">
                  <div className={`flex justify-center ${tool.color}`}>
                    <IconComponent size={56} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {tool.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {tool.description}
                  </p>
                  {isDisabled && (
                    <p className="text-xs font-medium text-amber-600">
                      Cần chọn khóa học hoặc nhập danh sách
                    </p>
                  )}
                </div>

                {!isDisabled && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="text-center">
                      <div className="inline-block rounded-full bg-brand-600 px-4 py-2 text-white font-semibold text-sm">
                        Mở
                      </div>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
