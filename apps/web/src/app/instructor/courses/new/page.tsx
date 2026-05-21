"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

export default function NewCoursePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("vi");
  const [level, setLevel] = useState("beginner");
  const [category, setCategory] = useState("");
  const [personalizationEnabled, setPersonalizationEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const res = await fetch(apiUrl("/api/courses"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        language,
        level,
        category: category || undefined,
        personalizationEnabled,
      }),
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
      <Link
        href="/instructor/courses"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Khóa của tôi
      </Link>

      <div className="mt-4">
        <span className="chip-brand">Instructor</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Tạo khóa học mới
        </h1>
        <p className="mt-2 text-muted">
          Khởi tạo nháp — bạn có thể bổ sung module, lesson, quiz ở bước tiếp theo.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 card space-y-5">
        <div>
          <label className="label" htmlFor="title">Tiêu đề</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Ví dụ: Đại số cơ bản"
            className="input mt-1.5"
          />
        </div>
        <div>
          <label className="label" htmlFor="description">Mô tả</label>
          <div className="mt-1.5">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Khóa học này dành cho ai? Học xong sẽ làm được gì?"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="level">Level</label>
            <select
              id="level"
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
            <label className="label" htmlFor="language">Ngôn ngữ</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="select mt-1.5"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={80}
              placeholder="data-science"
              className="input mt-1.5"
            />
          </div>
        </div>
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={personalizationEnabled}
              onChange={(e) => setPersonalizationEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <div className="min-w-0">
              <span className="font-medium">Bật cá nhân hoá học tập (AI feedback theo skill)</span>
              <p className="mt-1 text-xs text-muted">
                Khi bật: mỗi bài học cần tag ít nhất 1 skill mới publish được;
                learner nhận diagnostic feedback, adaptive path và skill badge.
                Khi tắt (mặc định): course chạy như LMS truyền thống, publish không cần tag skill.
                Có thể đổi sau trong cài đặt course.
              </p>
            </div>
          </label>
        </div>
        {error && (
          <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            Lỗi: {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-3 border-t border-token pt-4">
          <Link href="/instructor/courses" className="btn-ghost">
            Hủy
          </Link>
          <button
            type="submit"
            disabled={status === "submitting"}
            className="btn-primary"
          >
            {status === "submitting" ? "Đang tạo..." : "Tạo khóa học"}
          </button>
        </div>
      </form>
    </main>
  );
}
