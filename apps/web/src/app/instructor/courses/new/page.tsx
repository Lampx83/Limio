"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

type FieldKey = "title" | "description" | "language" | "level" | "category";
type FieldErrors = Partial<Record<FieldKey, string>>;

// Trường bắt buộc theo CreateCourseInput (core-lms): title + description
// (min 1 sau trim). Các trường còn lại tuỳ chọn hoặc luôn có giá trị mặc định.
const FIELD_ORDER: FieldKey[] = ["title", "description", "language", "level", "category"];
const FIELD_LABEL: Record<FieldKey, string> = {
  title: "tiêu đề",
  description: "mô tả",
  language: "ngôn ngữ",
  level: "cấp độ",
  category: "danh mục",
};
const REQUIRED_MESSAGE: Partial<Record<FieldKey, string>> = {
  title: "Vui lòng nhập tiêu đề khoá học",
  description: "Vui lòng nhập mô tả khoá học",
};
const FIELD_FOCUS_ID: Record<FieldKey, string> = {
  title: "title",
  description: "description-field",
  language: "language",
  level: "level",
  category: "category",
};

/** Mô tả từ trình soạn thảo là HTML — "<p></p>" cũng phải tính là rỗng. */
function isBlankHtml(html: string): boolean {
  if (/<(img|iframe|video|table|hr)\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "").length === 0;
}

function validateClient(v: { title: string; description: string; category: string }): FieldErrors {
  const e: FieldErrors = {};
  if (!v.title.trim()) e.title = REQUIRED_MESSAGE.title;
  else if (v.title.trim().length > 200) e.title = "Tiêu đề tối đa 200 ký tự";
  if (isBlankHtml(v.description)) e.description = REQUIRED_MESSAGE.description;
  else if (v.description.trim().length > 20_000) e.description = "Mô tả quá dài (tối đa 20.000 ký tự)";
  if (v.category.length > 80) e.category = "Danh mục tối đa 80 ký tự";
  return e;
}

/** Đọc `details` (zod flatten) từ server → thông báo theo từng trường. */
function mapServerIssues(details: unknown): FieldErrors {
  const out: FieldErrors = {};
  const fe = (details as { fieldErrors?: Record<string, string[] | undefined> } | null)?.fieldErrors;
  if (!fe) return out;
  for (const key of FIELD_ORDER) {
    if (!fe[key]?.length) continue;
    out[key] = REQUIRED_MESSAGE[key] ?? `Giá trị ${FIELD_LABEL[key]} không hợp lệ`;
  }
  return out;
}

const CREATE_ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Tài khoản của bạn chưa được cấp quyền giảng viên nên chưa tạo được khoá học.",
  validation_failed: "Thông tin khoá học chưa hợp lệ. Vui lòng kiểm tra các ô được đánh dấu đỏ.",
};

function RequiredMark() {
  return (
    <span className="ml-0.5 text-danger-600" aria-hidden="true">
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-danger-700">
      {message}
    </p>
  );
}

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  function clearFieldError(k: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev[k]) return prev;
      const { [k]: _drop, ...rest } = prev;
      return rest;
    });
  }

  function focusFirstError(errs: FieldErrors) {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (!first) return;
    const el = document.getElementById(FIELD_FOCUS_ID[first]);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Trình soạn thảo mô tả: focus vào vùng contenteditable bên trong.
    const target =
      el.matches("input,select,textarea") ? el : (el.querySelector<HTMLElement>("[contenteditable=true]") ?? el);
    target.focus({ preventScroll: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clientErrors = validateClient({ title, description, category });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setStatus("error");
      setError("Vui lòng điền các thông tin bắt buộc được đánh dấu đỏ.");
      // Chờ React vẽ lỗi rồi mới focus.
      setTimeout(() => focusFirstError(clientErrors), 0);
      return;
    }
    setFieldErrors({});
    setStatus("submitting");
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/courses"), {
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
    } catch {
      setStatus("error");
      setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
      return;
    }
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
      if (data?.error === "validation_failed") {
        const mapped = mapServerIssues(data.details);
        setFieldErrors(mapped);
        setError("Thông tin khoá học chưa hợp lệ. Vui lòng kiểm tra các ô được đánh dấu đỏ.");
        setTimeout(() => focusFirstError(mapped), 0);
      } else {
        setError(
          CREATE_ERROR_MESSAGES[data?.error as string] ??
            (res.status >= 500
              ? "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút."
              : "Không tạo được khoá học. Vui lòng thử lại."),
        );
      }
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
      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-5 card space-y-4">
        <p className="text-meta text-muted">
          <span className="text-danger-600" aria-hidden="true">*</span> Bắt buộc
        </p>
        <header className="border-b border-token pb-3">
          <h3 className="text-base font-semibold">Thông tin course</h3>
        </header>
        <div>
          <label className="label" htmlFor="title">Tiêu đề<RequiredMark /> <span className="sr-only">(bắt buộc)</span></label>
          <input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearFieldError("title");
            }}
            required
            aria-required="true"
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={fieldErrors.title ? "title-error" : undefined}
            maxLength={200}
            placeholder="Ví dụ: Đại số cơ bản"
            className={`input mt-1.5 ${fieldErrors.title ? "border-danger-500 ring-1 ring-danger-500" : ""}`}
          />
          <FieldError id="title-error" message={fieldErrors.title} />
        </div>
        <div>
          <label className="label" id="description-label">Mô tả<RequiredMark /> <span className="sr-only">(bắt buộc)</span></label>
          <div
            id="description-field"
            role="group"
            aria-labelledby="description-label"
            aria-required="true"
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={fieldErrors.description ? "description-error" : undefined}
            className={`mt-1.5 rounded-lg ${fieldErrors.description ? "border border-danger-500 ring-1 ring-danger-500" : ""}`}
          >
            <RichTextEditor
              value={description}
              onChange={(v) => {
                setDescription(v);
                clearFieldError("description");
              }}
              placeholder="Khóa học này dành cho ai? Học xong sẽ làm được gì?"
            />
          </div>
          <FieldError id="description-error" message={fieldErrors.description} />
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
            <label className="label" htmlFor="category">Category <span className="text-faint">(không bắt buộc)</span></label>
            <input
              id="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                clearFieldError("category");
              }}
              maxLength={80}
              placeholder="data-science"
              aria-invalid={fieldErrors.category ? true : undefined}
              className={`input mt-1.5 ${fieldErrors.category ? "border-danger-500 ring-1 ring-danger-500" : ""}`}
            />
            <FieldError id="category-error" message={fieldErrors.category} />
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
          <div role="alert" className="banner-danger text-sm">
            {error}
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
