"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

type Mode = "auto" | "manual";

/** Chọn space nào hiện ở mục "Không gian học liệu" của /catalog (docs/tieu-chi/space-catalog-xem-truoc.md, AC4). */
export default function CatalogSpacesManager({
  initialMode,
  initialSlugs,
  choices,
}: {
  initialMode: Mode;
  initialSlugs: string[];
  choices: Array<{ slug: string; name: string }>;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [slugs, setSlugs] = useState<string[]>(initialSlugs);
  const [busy, setBusy] = useState(false);
  const nameOf = (s: string) => choices.find((c) => c.slug === s)?.name ?? s;
  const addable = choices.filter((c) => !slugs.includes(c.slug));
  const move = (i: number, d: -1 | 1) =>
    setSlugs((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/catalog-spaces"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, slugs: mode === "manual" ? slugs : [] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error("Chưa lưu được", { description: d?.error === "unknown_space" ? `Space không còn bật: ${(d.slugs ?? []).join(", ")}` : "Thử lại sau." });
        return;
      }
      toast.success("Đã lưu", { description: "Trang /catalog áp dụng ngay." });
    } catch {
      toast.error("Mạng không ổn định, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="catalog-spaces-admin-title">
      <h2 id="catalog-spaces-admin-title" className="text-lg font-semibold">
        Không gian học liệu ở /catalog
      </h2>
      <p className="help mt-1">
        Mục này nằm đầu trang <span className="font-mono">/catalog</span>, mỗi space một thẻ có vài khoá xem trước. Chọn space nào hiện và thứ tự.
      </p>
      <fieldset className="mt-3 grid gap-2">
        <legend className="sr-only">Cách chọn space</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="spaces-mode" className="mt-1" checked={mode === "auto"} onChange={() => setMode("auto")} />
          <span>
            <b>Tự động</b> — hiện mọi space đang bật, xếp theo tên ({choices.length} space).
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="spaces-mode" className="mt-1" checked={mode === "manual"} onChange={() => setMode("manual")} />
          <span>
            <b>Chọn tay</b> — chỉ các space trong danh sách, theo thứ tự đó (danh sách rỗng = ẩn cả mục).
          </span>
        </label>
      </fieldset>

      {mode === "manual" && (
        <>
          <ol className="mt-3 grid gap-2">
            {slugs.map((s, i) => (
              <li key={s} className="flex flex-wrap items-center gap-2 rounded-lg border border-token p-3">
                <span className="w-6 text-sm font-bold text-faint">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{nameOf(s)}</span>
                  <span className="block font-mono text-xs text-muted">{s}</span>
                </span>
                <span className="flex items-center">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === slugs.length - 1} aria-label="Xuống"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setSlugs((xs) => xs.filter((_, k) => k !== i))} aria-label="Bỏ space khỏi catalog"><Trash2 className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ol>
          {slugs.length === 0 && <p className="help mt-3">Chưa chọn space nào: mục "Không gian học liệu" sẽ ẩn khỏi /catalog.</p>}
          {addable.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted" aria-hidden />
              <select
                className="select w-full sm:w-auto sm:max-w-xs"
                value=""
                aria-label="Thêm space vào catalog"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setSlugs((xs) => (xs.includes(v) ? xs : [...xs, v]));
                }}
              >
                <option value="">Thêm space…</option>
                {addable.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name} ({c.slug})</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <div className="mt-4">
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </section>
  );
}
