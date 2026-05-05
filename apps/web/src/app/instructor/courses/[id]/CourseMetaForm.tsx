"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface Initial {
  title: string;
  description: string;
  level: string;
  language: string;
  category: string;
  priceCents: number | null;
  currency: string;
}

export default function CourseMetaForm({
  courseId,
  initial,
}: {
  courseId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [level, setLevel] = useState(initial.level);
  const [language, setLanguage] = useState(initial.language);
  const [category, setCategory] = useState(initial.category);
  const [priceCents, setPriceCents] = useState<string>(
    initial.priceCents !== null && initial.priceCents !== undefined
      ? String(initial.priceCents)
      : "",
  );
  const [currency, setCurrency] = useState(initial.currency || "VND");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="link text-sm">
        Sửa thông tin course
      </button>
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const parsedPrice = priceCents.trim() === "" ? null : parseInt(priceCents, 10);
    const res = await fetch(apiUrl(`/api/instructor/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        level,
        language,
        category: category.trim() || null,
        priceCents: parsedPrice,
        currency,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSave} className="card space-y-4">
      <header className="border-b border-token pb-3">
        <h3 className="text-base font-semibold">Thông tin course</h3>
      </header>
      <div>
        <label className="label" htmlFor="cm-title">Tiêu đề</label>
        <input
          id="cm-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input mt-1.5"
          required
          maxLength={200}
        />
      </div>
      <div>
        <label className="label" htmlFor="cm-desc">Mô tả</label>
        <textarea
          id="cm-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="textarea mt-1.5"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="cm-level">Level</label>
          <select
            id="cm-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="select mt-1.5"
          >
            <option value="beginner">Cơ bản</option>
            <option value="intermediate">Trung cấp</option>
            <option value="advanced">Nâng cao</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cm-lang">Ngôn ngữ</label>
          <select
            id="cm-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="select mt-1.5"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cm-cat">Category</label>
          <input
            id="cm-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={80}
            className="input mt-1.5"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="cm-price">
            Giá khoá học
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="cm-price"
              type="number"
              min={0}
              step={1000}
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
              placeholder="Để trống = miễn phí"
              className="input flex-1"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="select w-24"
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <p className="mt-1 text-xs text-faint">
            {currency === "VND"
              ? "Nhập số nguyên (đồng). Ví dụ: 299000"
              : "Nhập số cents. Ví dụ: 999 = $9.99"}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-token pt-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost"
        >
          Hủy
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
