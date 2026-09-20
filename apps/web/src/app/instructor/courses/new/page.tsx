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
  const [enrollMode, setEnrollMode] = useState<"open" | "invite_only">("open");
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
        enrollMode,
      }),
    });
    if (res.status === 401) {
      window.location.href = "/signin?callbackUrl=/instructor/courses/new";
      return;
    }
    if (res.ok) {
      // Khung 3 module × 3 bài đã được dựng sẵn ở API — sang thẳng danh sách
      // module để soạn tiếp, như "Lưu và tiếp tục" ở form thông tin khoá.
      const created = (await res.json().catch(() => null)) as { courseId?: string } | null;
      window.location.href = created?.courseId
        ? `/instructor/courses/${created.courseId}?tab=content`
        : "/instructor/courses";
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(data.error ?? "create_failed");
    }
  }

  return (
    <main>
      <Link
        href="/instructor/courses"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Khóa của tôi
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-bold">Tạo khóa học mới</h1>
        <p className="mt-1 text-sm text-muted">
          Khởi tạo nháp — bạn có thể bổ sung module, lesson, quiz ở bước tiếp theo.
        </p>
      </div>

      {/* Cùng khung, cùng thứ tự trường với form "Sửa" thông tin khoá ở tab
          Tổng quan (CourseMetaForm) để tạo mới và chỉnh sửa trông như một. */}
      <form onSubmit={onSubmit} className="mt-5 card space-y-4">
        <header className="border-b border-token pb-3">
          <h3 className="text-base font-semibold">Thông tin course</h3>
        </header>
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
        {/* Ai vào được khoá. Hỏi ngay lúc tạo vì đổi sau khi đã phát link thì
            những người vào rồi vẫn ở lại — chặn cửa không đuổi được ai. */}
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
        <fieldset>
          <legend className="text-sm font-semibold">Ai vào được khoá này</legend>
          <label className="flex cursor-pointer items-start gap-3 py-1.5">
            <input
              type="radio"
              name="enrollMode"
              checked={enrollMode === "open"}
              onChange={() => setEnrollMode("open")}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              <span className="font-medium">Mở — ai cũng tự đăng ký được</span>
              <span className="mt-0.5 block text-xs text-muted">
                Người vào trang giới thiệu khoá thấy nút đăng ký và tự ghi danh.
                Hợp với khoá mở rộng rãi.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 py-1.5">
            <input
              type="radio"
              name="enrollMode"
              checked={enrollMode === "invite_only"}
              onChange={() => setEnrollMode("invite_only")}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              <span className="font-medium">Chỉ vào bằng link mời lớp</span>
              <span className="mt-0.5 block text-xs text-muted">
                Trang giới thiệu vẫn xem được nhưng không có nút đăng ký. Chỉ ai
                có link mời của một lớp cụ thể mới vào được — và vào thẳng đúng
                lớp đó, không rơi vào “chưa gán lớp”.
              </span>
            </span>
          </label>
        </fieldset>
        </div>

        {error && (
          <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            Lỗi: {error}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-token pt-4">
          <Link href="/instructor/courses" className="btn-ghost">
            Hủy
          </Link>
          <button
            type="submit"
            disabled={status === "submitting"}
            className="btn-primary"
          >
            {status === "submitting" ? "Đang tạo..." : "Tạo và tiếp tục"}
          </button>
        </div>
      </form>
    </main>
  );
}
