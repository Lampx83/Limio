"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface Skill {
  id: string;
  code: string;
  name: string;
}

interface Props {
  value: Skill[];
  onChange: (skills: Skill[]) => void;
}

export default function SkillPicker({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (q.trim().length === 0) {
        setResults([]);
        return;
      }
      setLoading(true);
      const res = await fetch(apiUrl(`/api/skills?q=${encodeURIComponent(q)}&limit=8`));
      const data = (await res.json().catch(() => ({}))) as { items?: Skill[] };
      if (!cancelled) {
        setResults(data.items ?? []);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const add = (s: Skill) => {
    if (value.some((v) => v.id === s.id)) return;
    onChange([...value, s]);
    setQ("");
    setResults([]);
  };
  const remove = (id: string) => onChange(value.filter((s) => s.id !== id));

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {value.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-800"
          >
            {s.name}
            <button
              type="button"
              onClick={() => remove(s.id)}
              className="text-blue-600 hover:text-red-600"
              aria-label="Bỏ"
            >
              ×
            </button>
          </span>
        ))}
        {value.length === 0 && (
          <span className="text-xs text-faint">Chưa gắn skill nào.</span>
        )}
      </div>
      <div className="relative mt-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm skill theo tên hoặc mã…"
          className="w-full rounded border border-default px-2 py-1 text-sm"
        />
        {q.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded border border-default bg-white shadow-md">
            {loading ? (
              <div className="px-3 py-2 text-xs text-faint">Đang tìm…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-faint">Không có kết quả</div>
            ) : (
              results.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => add(s)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium">{s.name}</span>{" "}
                  <span className="text-xs text-faint">({s.code})</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
