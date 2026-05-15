"use client";

import { BarChart3, Cloud, Clock, Users, Shuffle } from "lucide-react";

export type ToolType = "poll" | "wordcloud" | "timer" | "random-picker" | "grouping" | null;

interface TeachingToolsWrapperProps {
  onSelectTool: (tool: ToolType) => void;
}

const TOOLS = [
  {
    id: "poll",
    icon: BarChart3,
    label: "Quick Poll",
    description: "Tạo poll trắc nghiệm nhanh",
    category: "standalone",
  },
  {
    id: "wordcloud",
    icon: Cloud,
    label: "Word Cloud",
    description: "Thu thập đáp án dạng từ",
    category: "standalone",
  },
  {
    id: "timer",
    icon: Clock,
    label: "Đếm Ngược",
    description: "Bộ đếm ngược thời gian",
    category: "standalone",
  },
  {
    id: "random-picker",
    icon: Shuffle,
    label: "Chọn Ngẫu Nhiên",
    description: "Chọn ngẫu nhiên sinh viên",
    category: "student-list",
  },
  {
    id: "grouping",
    icon: Users,
    label: "Phân Nhóm",
    description: "Chia lớp thành các nhóm",
    category: "student-list",
  },
];

export default function TeachingToolsWrapper({ onSelectTool }: TeachingToolsWrapperProps) {
  const standalone = TOOLS.filter((t) => t.category === "standalone");
  const studentTools = TOOLS.filter((t) => t.category === "student-list");

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-6 items-center rounded-full bg-accent-100 px-2.5 text-xs font-semibold text-accent-700 dark:bg-accent-900/30 dark:text-accent-300">
            Cả lớp tham gia
          </span>
          <h2 className="text-lg font-semibold">Tương tác nhanh với cả lớp</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {standalone.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id as ToolType)}
                className="group relative overflow-hidden rounded-2xl border border-accent-200 bg-white p-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-lg dark:border-accent-900/40 dark:bg-[rgb(var(--surface))]"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-400 to-accent-600" />
                <div className="relative space-y-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-accent-700 transition-colors group-hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300">
                    <Icon size={28} strokeWidth={2} />
                  </div>
                  <h3 className="text-base font-bold">{tool.label}</h3>
                  <p className="text-sm text-muted">{tool.description}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="inline-block rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                    Mở
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center gap-3">
          <span className="inline-flex h-6 items-center rounded-full bg-brand-100 px-2.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Theo danh sách lớp
          </span>
          <h2 className="text-lg font-semibold">Làm việc với danh sách sinh viên</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Khi mở công cụ, bạn sẽ chọn nguồn sinh viên (khóa học hoặc nhập thủ công) riêng cho lần sử dụng đó.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studentTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id as ToolType)}
                className="group relative overflow-hidden rounded-2xl border border-brand-200 bg-white p-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg dark:border-brand-900/40 dark:bg-[rgb(var(--surface))]"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
                <div className="relative space-y-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 transition-colors group-hover:bg-brand-200 dark:bg-brand-900/30 dark:text-brand-300">
                    <Icon size={28} strokeWidth={2} />
                  </div>
                  <h3 className="text-base font-bold">{tool.label}</h3>
                  <p className="text-sm text-muted">{tool.description}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="inline-block rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                    Mở
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
