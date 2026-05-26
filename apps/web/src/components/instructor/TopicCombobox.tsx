"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

/**
 * Combobox cho field "Chủ đề" (Topic):
 *   - Hiển thị suggestions từ `availableTopics` đã có sẵn (filter theo input).
 *   - User chọn topic có sẵn → set value.
 *   - User nhập text mới không match → hiện option "+ Tạo mới: X" cuối list.
 *   - Chọn "Tạo mới" → set value = text vừa nhập (sẽ được DB ghi nhận khi save).
 *
 * Khuyến khích chọn topic đã có để tránh trùng lặp do typo. Free-text vẫn
 * được phép — không ép buộc dùng từ list (instructor có flexibility).
 *
 * Controlled component: parent giữ value + setValue.
 */
export default function TopicCombobox({
  value,
  onChange,
  availableTopics,
  placeholder = "Chọn hoặc nhập chủ đề mới...",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  availableTopics: string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep query in sync with parent value (e.g., when editing different
  // question and value resets).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const q = query.trim();
  const filtered = useMemo(() => {
    if (!q) return availableTopics;
    const lower = q.toLowerCase();
    return availableTopics.filter((t) => t.toLowerCase().includes(lower));
  }, [availableTopics, q]);

  const exactMatch = useMemo(
    () => availableTopics.some((t) => t.toLowerCase() === q.toLowerCase()),
    [availableTopics, q],
  );

  function pick(v: string) {
    onChange(v);
    setQuery(v);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          // Đồng bộ value ngay với parent — nếu user gõ rồi blur, không
          // bị mất chữ. Chọn từ dropdown sẽ overwrite.
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full rounded border border-default bg-white px-2 py-1.5 text-xs"
      />

      {open && (filtered.length > 0 || (q && !exactMatch)) && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-default bg-white shadow-lg">
          {filtered.length > 0 && (
            <div className="border-b border-default px-2 py-1 text-[10px] font-semibold uppercase text-faint">
              Chủ đề đã có
            </div>
          )}
          <ul className="text-xs">
            {filtered.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => pick(t)}
                  className={`flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-blue-50 ${
                    t === value ? "bg-blue-100 font-medium text-blue-800" : "text-slate-700"
                  }`}
                >
                  <span>{t}</span>
                  {t === value && <span className="text-blue-600">✓</span>}
                </button>
              </li>
            ))}
          </ul>
          {q && !exactMatch && (
            <>
              {filtered.length > 0 && (
                <div className="border-t border-default px-2 py-1 text-[10px] font-semibold uppercase text-faint">
                  Hoặc tạo mới
                </div>
              )}
              <button
                type="button"
                onClick={() => pick(q)}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-3 w-3" />
                <span>
                  Tạo mới: <span className="font-semibold">"{q}"</span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
