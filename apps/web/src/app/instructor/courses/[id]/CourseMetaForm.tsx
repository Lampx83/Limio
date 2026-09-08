"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";
import SafeHtml from "@/components/SafeHtml";
import { toast } from "@/lib/toast";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

interface Initial {
  title: string;
  description: string;
  level: string;
  language: string;
  category: string;
  priceCents: number | null;
  currency: string;
  personalizationEnabled: boolean;
  publicAccess: boolean;
  enrollMode: "open" | "invite_only";
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
  const [description, setDescription] = useState(plainToRichHtml(initial.description));
  const [level, setLevel] = useState(initial.level);
  const [language, setLanguage] = useState(initial.language);
  const [category, setCategory] = useState(initial.category);
  const [priceCents, setPriceCents] = useState<string>(
    initial.priceCents !== null && initial.priceCents !== undefined
      ? String(initial.priceCents)
      : "",
  );
  const [currency, setCurrency] = useState(initial.currency || "VND");
  const [personalizationEnabled, setPersonalizationEnabled] = useState(
    initial.personalizationEnabled,
  );
  const [publicAccess, setPublicAccess] = useState(initial.publicAccess);
  const [enrollMode, setEnrollMode] = useState(initial.enrollMode);
  const [busy, setBusy] = useState(false);

  const LEVEL_LABEL: Record<string, string> = {
    beginner: "Cơ bản",
    intermediate: "Trung cấp",
    advanced: "Nâng cao",
  };

  if (!open) {
    const priceDisplay =
      initial.priceCents === null || initial.priceCents === undefined
        ? "Miễn phí"
        : `${Number(initial.priceCents).toLocaleString("vi-VN")} ${initial.currency || "VND"}`;

    return (
      <div className="card space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-snug">{initial.title}</h3>
            {initial.description && (
              <SafeHtml
                html={plainToRichHtml(initial.description)}
                className="prose prose-sm mt-2 max-w-none text-muted dark:prose-invert"
              />
            )}
          </div>
          <button onClick={() => setOpen(true)} className="btn-secondary btn-sm shrink-0">
            Sửa
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-token pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-faint">Level</dt>
            <dd className="mt-0.5 font-medium">{LEVEL_LABEL[initial.level] ?? initial.level}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-faint">Ngôn ngữ</dt>
            <dd className="mt-0.5 font-medium">{initial.language === "vi" ? "Tiếng Việt" : "English"}</dd>
          </div>
          {initial.category && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-faint">Category</dt>
              <dd className="mt-0.5 font-medium">{initial.category}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-faint">Giá</dt>
            <dd className="mt-0.5 font-medium">{priceDisplay}</dd>
          </div>
        </dl>
      </div>
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const parsedPrice = priceCents.trim() === "" ? null : parseInt(priceCents, 10);
    const res = await fetch(apiUrl(`/api/instructor/courses/${courseId}`), {
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
        personalizationEnabled,
        publicAccess,
        enrollMode,
      }),
    });
    setBusy(false);
    if (res.ok) {
      // Trước đây lưu xong thu gọn form về thẻ tóm tắt — bản thân việc thu
      // gọn LÀ tín hiệu "đã lưu". Giữ form mở lại (dễ sửa tiếp, dễ soi đúng
      // cái vừa đổi) thì tín hiệu đó mất, nên phải nói ra bằng toast — không
      // thì lưu thành công và lưu thất bại trông giống hệt nhau.
      toast.success("Đã lưu thay đổi");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error("Lưu thất bại", {
        description: data.error ?? "Vui lòng thử lại.",
      });
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
        <div className="mt-1.5">
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
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
      <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={personalizationEnabled}
            onChange={(e) => setPersonalizationEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <div className="min-w-0">
            <span className="font-medium">Cá nhân hoá học tập (AI feedback theo skill)</span>
            <p className="mt-1 text-xs text-muted">
              Bật → mỗi bài cần tag ≥1 skill mới publish được; learner nhận
              diagnostic feedback, adaptive path và skill badge.
              Tắt → course chạy như LMS truyền thống, publish bỏ qua kiểm tra
              skill. Đổi flag chỉ áp dụng ở lần publish kế tiếp.
            </p>
          </div>
        </label>
      </div>
      <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
        <fieldset className="mb-3 border-b border-token pb-3">
          <legend className="text-sm font-semibold">Ai vào được khoá này</legend>
          <label className="flex cursor-pointer items-start gap-3 py-1.5">
            <input
              type="radio"
              name="enrollMode"
              checked={enrollMode === "open"}
              onChange={() => setEnrollMode("open")}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium">Mở — ai cũng tự đăng ký được</span>
              <span className="mt-0.5 block text-xs text-muted">
                Trang giới thiệu có nút đăng ký (miễn phí) hoặc ô nhập mã kích
                hoạt (nếu đặt giá bên dưới).
              </span>
              {/* Giá chỉ có nghĩa ở nhánh "Mở": link mời không có nơi nào để
                  trả tiền — trang /enroll/[code] không có UI nhập mã, không xử
                  lý lỗi đòi thanh toán. Đặt lồng trong nhánh này thay vì để một
                  mục Pricing riêng, để không ai đặt được giá cho khoá invite_only
                  trên chính giao diện — server (updateCourse) vẫn ép lại bất
                  biến này dù client có lỡ gửi gì. */}
              {enrollMode === "open" && (
                <span className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={priceCents}
                    onChange={(e) => setPriceCents(e.target.value)}
                    placeholder="Để trống = miễn phí"
                    className="input flex-1"
                    aria-label="Giá khoá học"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="select w-24"
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                  </select>
                </span>
              )}
              {enrollMode === "open" && (
                <span className="mt-1 block text-xs text-faint">
                  {currency === "VND"
                    ? "Nhập số nguyên (đồng). Ví dụ: 299000."
                    : "Nhập số cents. Ví dụ: 999 = $9.99."}{" "}
                  Có giá → sinh mã kích hoạt ở mục bên dưới sau khi lưu.
                </span>
              )}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 py-1.5">
            <input
              type="radio"
              name="enrollMode"
              checked={enrollMode === "invite_only"}
              onChange={() => {
                if (priceCents.trim() !== "") {
                  const priceLabel = `${Number(priceCents).toLocaleString("vi-VN")} ${currency}`;
                  const ok = window.confirm(
                    `Khoá đang có giá ${priceLabel}. Chuyển sang "Chỉ vào bằng link mời lớp" sẽ xoá giá này — khoá trở thành miễn phí cho người có link. Tiếp tục?`,
                  );
                  if (!ok) return;
                  setPriceCents("");
                }
                setEnrollMode("invite_only");
              }}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              <span className="text-sm font-medium">Chỉ vào bằng link mời lớp</span>
              <span className="mt-0.5 block text-xs text-muted">
                Trang giới thiệu bỏ nút đăng ký. Chỉ ai có link mời của một lớp
                mới vào được, và vào thẳng đúng lớp đó.
              </span>
            </span>
          </label>
          {/* Đổi sang chỉ-mời không đuổi ai ra: nó chặn cửa, không dọn nhà. */}
          {enrollMode === "invite_only" && initial.enrollMode === "open" && (
            <p className="mt-1 text-xs text-accent-700">
              Người đã ghi danh trước đó vẫn ở lại khoá — thiết lập này chỉ chặn
              người đăng ký mới.
            </p>
          )}
        </fieldset>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={publicAccess}
            onChange={(e) => setPublicAccess(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <div className="min-w-0">
            <span className="font-medium">Công khai — xem được không cần đăng nhập</span>
            <p className="mt-1 text-xs text-muted">
              Bật → bất kỳ ai, kể cả khách chưa đăng nhập, đọc được mọi bài học
              (nội dung + video) mà không cần ghi danh. Các tính năng cần tài khoản
              — tiến độ, hoàn thành bài, ghi chú, thảo luận, quiz, AI tutor — vẫn ẩn.
              Tắt → bài học yêu cầu đăng nhập như bình thường.
              Chỉ có hiệu lực khi course đã publish; course draft không bao giờ công khai.
            </p>
            {publicAccess && enrollMode === "open" && priceCents.trim() !== "" && (
              <p className="mt-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800">
                ⚠ Đang thu phí nhưng bật công khai — ai cũng đọc được hết nội
                dung miễn phí, mất lý do trả tiền. Muốn học viên xem thử trước
                khi mua, dùng nút &ldquo;Cho preview&rdquo; ở từng bài thay vì
                bật cả khoá.
              </p>
            )}
          </div>
        </label>
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
