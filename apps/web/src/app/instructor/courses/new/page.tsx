"use client";

import { useState } from "react";

export default function NewCoursePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("vi");
  const [level, setLevel] = useState("beginner");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, language, level, category: category || undefined }),
    });
    if (res.status === 401) {
      window.location.href = "/signin?callbackUrl=/instructor/courses/new";
      return;
    }
    if (res.ok) {
      window.location.href = "/instructor/courses";
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(data.error ?? "create_failed");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">Tạo khóa học mới</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Tiêu đề</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Mô tả</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Level</span>
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
            <span className="text-sm font-medium">Ngôn ngữ</span>
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
            <span className="text-sm font-medium">Category</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={80}
              placeholder="e.g. data-science"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {status === "submitting" ? "Đang tạo..." : "Tạo khóa học"}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-600">Lỗi: {error}</p>}
    </main>
  );
}
