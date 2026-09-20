"use client";

import { useState } from "react";
import { isAutoLessonSkillCode } from "@feedbackme/shared-types";

interface Skill {
  id: string;
  code: string;
  name: string;
}

const MAX_SUGGESTIONS = 8;

/**
 * Chọn chủ đề gọn: chip đã chọn + ô tìm kiếm có gợi ý, thay cho việc dàn cả
 * danh sách skill của hệ thống ra thành hàng trăm chip.
 *
 * Skill tự sinh từ bài học (`lesson.<id>`) không đưa vào gợi ý — câu hỏi đã
 * tự thuộc chủ đề của bài (B1.5), và mã UUID đó vô nghĩa với GV. Nếu câu đang
 * mang sẵn một tag như vậy thì vẫn hiện thành chip để không bị gỡ âm thầm.
 */
export default function SkillTagPicker({
  skills,
  picked,
  onChange,
}: {
  skills: Skill[];
  picked: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);

  const byId = new Map(skills.map((s) => [s.id, s]));
  const query = q.trim().toLowerCase();
  const matches = skills
    .filter(
      (s) =>
        !picked.includes(s.id) &&
        !isAutoLessonSkillCode(s.code) &&
        (query === "" ||
          s.code.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query)),
    )
    .slice(0, MAX_SUGGESTIONS);

  function add(id: string) {
    onChange([...picked, id]);
    setQ("");
  }

  return (
    <div>
      {picked.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {picked.map((id) => {
            const s = byId.get(id);
            const auto = s ? isAutoLessonSkillCode(s.code) : false;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-600 py-0.5 pl-2.5 pr-1 text-xs font-medium text-white"
                title={s?.code}
              >
                {auto ? "Chủ đề của bài học" : (s?.name || s?.code || id)}
                <button
                  type="button"
                  onClick={() => onChange(picked.filter((x) => x !== id))}
                  aria-label="Bỏ chủ đề"
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/25"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Tìm chủ đề để gắn thêm…"
          className="input"
        />
        {focused && matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-lg border border-token bg-[rgb(var(--surface))] py-1 shadow-md">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(s.id)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-soft"
                >
                  {s.name && s.name !== s.code ? (
                    <>
                      {s.name} <span className="text-xs text-faint">{s.code}</span>
                    </>
                  ) : (
                    s.code
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {focused && matches.length === 0 && query !== "" && (
          <p className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm text-faint shadow-md">
            Không có chủ đề nào khớp.
          </p>
        )}
      </div>
      <p className="mt-1.5 text-xs text-faint">
        Mặc định câu hỏi thuộc chủ đề của bài học. Chỉ gắn thêm khi cần.
      </p>
    </div>
  );
}
