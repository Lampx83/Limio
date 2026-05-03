"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Initial {
  title: string;
  description: string;
  level: string;
  language: string;
  category: string;
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
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 text-sm text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
      >
        ✎ Sửa thông tin course
      </button>
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        level,
        language,
        category: category.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={onSave}
      className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
    >
      <label className="block">
        <span className="text-xs font-medium uppercase text-slate-500">Tiêu đề</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          required
          maxLength={200}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium uppercase text-slate-500">Mô tả</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          required
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Level</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Ngôn ngữ</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Category</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={80}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
