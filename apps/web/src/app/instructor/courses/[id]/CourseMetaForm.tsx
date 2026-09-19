"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";
import SafeHtml from "@/components/SafeHtml";
import { toast } from "@/lib/toast";
import { BarChart3, Languages, Tag, Wallet, PencilLine, Sparkles, BookOpen, type LucideIcon } from "lucide-react";

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

const FACT_TONE: Record<string, { chip: string; icon: string }> = {
  amber: {
    chip: "bg-amber-50 dark:bg-amber-950/30",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  sky: {
    chip: "bg-sky-50 dark:bg-sky-950/30",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  violet: {
    chip: "bg-violet-50 dark:bg-violet-950/30",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  pink: {
    chip: "bg-pink-50 dark:bg-pink-950/30",
    icon: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  },
  slate: {
    chip: "bg-slate-100 dark:bg-slate-800/40",
    icon: "bg-slate-200 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300",
  },
  lime: {
    chip: "bg-lime-50 dark:bg-lime-950/30",
    icon: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
  },
};

export default function CourseMetaForm({
  courseId,
  initial,
}: {
  courseId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
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

    const longDesc = initial.description.length > 280;
    const facts: Array<[LucideIcon, string, string, string]> = [
      [BarChart3, "Level", LEVEL_LABEL[initial.level] ?? initial.level, "amber"],
      [Languages, "Ngôn ngữ", initial.language === "vi" ? "Tiếng Việt" : "English", "sky"],
      ...(initial.category ? ([[Tag, "Category", initial.category, "violet"]] as Array<[LucideIcon, string, string, string]>) : []),
      [Wallet, "Giá", priceDisplay, "lime"],
      initial.personalizationEnabled
        ? [Sparkles, "Chế độ", "AI Feedback", "pink"]
        : [BookOpen, "Chế độ", "LMS thường", "slate"],
    ];

    return (
      <div className="card relative overflow-hidden !p-4 pl-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-lime-500" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <dl className="flex flex-wrap items-center gap-2">
            {facts.map(([Icon, k, v, tone]) => (
              <div
                key={k}
                title={
                  k === "Chế độ"
                    ? initial.personalizationEnabled
                      ? "Có AI feedback theo skill: BKT, chẩn đoán, lộ trình thích ứng, huy hiệu kỹ năng. Đổi bằng nút Sửa."
                      : "Chạy như LMS truyền thống, không có AI feedback. Đổi bằng nút Sửa."
                    : undefined
                }
                className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-3 ${FACT_TONE[tone]!.chip}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${FACT_TONE[tone]!.icon}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="leading-tight">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-faint">{k}</dt>
                  <dd className="text-sm font-semibold">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
          <button onClick={() => setOpen(true)} className="btn-secondary btn-sm inline-flex shrink-0 items-center gap-1.5">
            <PencilLine className="h-3.5 w-3.5" aria-hidden />
            Sửa
          </button>
        </div>
        {initial.description && (
          <div className="mt-3 border-t border-token pt-3">
            <SafeHtml
              html={plainToRichHtml(initial.description)}
              className={`prose prose-sm max-w-none text-muted dark:prose-invert ${
                longDesc && !descExpanded ? "line-clamp-3" : ""
              }`}
            />
            {longDesc && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="link mt-1 text-xs font-medium"
              >
                {descExpanded ? "Thu gọn" : "Xem thêm"}
              </button>
            )}
          </div>
        )}
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
      // Chuyển trang mất tín hiệu "form thu gọn = đã lưu", nên vẫn báo bằng toast.
      toast.success("Đã lưu thay đổi");
      // "Lưu và tiếp tục": thông tin khoá xong thì sang luôn danh sách module.
      router.push(`/instructor/courses/${courseId}?tab=content`);
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
          {busy ? "Đang lưu..." : "Lưu và tiếp tục"}
        </button>
      </div>
    </form>
  );
}
