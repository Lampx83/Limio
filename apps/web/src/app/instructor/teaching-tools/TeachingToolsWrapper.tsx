"use client";

import { useState } from "react";
import { Dice6, BarChart3, Cloud, Users, Clock } from "lucide-react";
import RandomPicker from "../classroom/RandomPicker";
import QuickPoll from "../classroom/QuickPoll";
import WordCloud from "../classroom/WordCloud";
import GroupingTool from "../classroom/GroupingTool";
import CountdownTimer from "../classroom/CountdownTimer";

interface StudentItem {
  name: string;
  id: string | null;
}

interface TeachingToolsWrapperProps {
  studentList: StudentItem[];
}

type ToolType = "picker" | "poll" | "wordcloud" | "grouping" | "timer" | null;

const TOOLS_NO_STUDENTS = [
  {
    id: "poll",
    icon: BarChart3,
    label: "Quick Poll",
    description: "Tạo poll trắc nghiệm nhanh",
    color: "text-blue-600"
  },
  {
    id: "wordcloud",
    icon: Cloud,
    label: "Word Cloud",
    description: "Thu thập đáp án dạng từ",
    color: "text-purple-600"
  },
  {
    id: "timer",
    icon: Clock,
    label: "Đếm Ngược",
    description: "Bộ đếm ngược thời gian",
    color: "text-orange-600"
  }
];

const TOOLS_WITH_STUDENTS = [
  {
    id: "picker",
    icon: Dice6,
    label: "Chọn Sinh Viên",
    description: "Chọn sinh viên ngẫu nhiên",
    color: "text-brand-600"
  },
  {
    id: "grouping",
    icon: Users,
    label: "Chia Nhóm",
    description: "Chia sinh viên vào các nhóm",
    color: "text-teal-600"
  }
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

        {selectedTool === "picker" && <RandomPicker studentList={studentList} />}
        {selectedTool === "poll" && <QuickPoll studentList={studentList} />}
        {selectedTool === "wordcloud" && <WordCloud studentList={studentList} />}
        {selectedTool === "grouping" && <GroupingTool studentList={studentList} />}
        {selectedTool === "timer" && <CountdownTimer />}
      </div>
    );
  }

  const renderToolGrid = (tools: typeof TOOLS_NO_STUDENTS) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => {
        const IconComponent = tool.icon;
        const isDisabled = TOOLS_WITH_STUDENTS.some(t => t.id === tool.id) && !studentList.length;

        return (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id as ToolType)}
            disabled={isDisabled}
            className={`group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300 ${
              isDisabled
                ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800/30"
                : "border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 hover:border-purple-400 hover:shadow-lg dark:border-purple-800 dark:from-purple-900/20 dark:to-purple-800/10"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-purple-200/0 opacity-0 transition-opacity duration-300 group-hover:opacity-10" />

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
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  Cần danh sách sinh viên
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
  );

  return (
    <div className="space-y-12">
      {/* Section 1: Tools không cần danh sách */}
      <div>
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          Công Cụ Cơ Bản
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Sử dụng các công cụ này mà không cần danh sách sinh viên
        </p>
        {renderToolGrid(TOOLS_NO_STUDENTS)}
      </div>

      {/* Section 2: Tools cần danh sách */}
      <div>
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          Công Cụ Cần Danh Sách Sinh Viên
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          {studentList.length > 0
            ? `Hiện có ${studentList.length} sinh viên`
            : "Vui lòng chọn khóa học hoặc nhập danh sách sinh viên ở phía trên"}
        </p>
        {renderToolGrid(TOOLS_WITH_STUDENTS)}
      </div>
    </div>
  );
}
