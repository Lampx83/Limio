"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import ShowcaseModePicker from "../[id]/ShowcaseModePicker";
import { tournamentErrorMessage } from "@/lib/tournamentText";
import {
  buildCreateTournamentPayload,
  defaultTournamentForm,
  endFromDuration,
  validateTournamentForm,
  type TournamentFormErrors,
  type TournamentFormState,
} from "@/lib/tournamentForm";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

const errCls = "mt-1.5 text-sm text-danger-600";
const hintCls = "mt-1.5 text-xs text-muted";
const labelCls = "mb-1.5 block text-sm font-medium";

const DURATIONS = [
  { days: 1, label: "1 ngày" },
  { days: 7, label: "1 tuần" },
  { days: 14, label: "2 tuần" },
];

export default function CreateTournamentForm({
  courses,
  canCreatePlatformWide,
}: {
  courses: Array<{ id: string; title: string }>;
  canCreatePlatformWide: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState<TournamentFormState>(() =>
    defaultTournamentForm(new Date(), courses.length === 1 && !canCreatePlatformWide ? courses[0]!.id : ""),
  );
  const [errors, setErrors] = useState<TournamentFormErrors>({});
  const [warnings, setWarnings] = useState<TournamentFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const durationDays = useMemo(() => {
    for (const d of DURATIONS) if (endFromDuration(s.startsAt, d.days) === s.endsAt) return d.days;
    return null;
  }, [s.startsAt, s.endsAt]);

  function set(patch: Partial<TournamentFormState>) {
    setS((prev) => ({ ...prev, ...patch }));
  }
  function clear(...keys: (keyof TournamentFormErrors)[]) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { errors: errs, warnings: warns } = validateTournamentForm(s, { now: new Date() });
    setErrors(errs);
    setWarnings(warns);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`ct-${first}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch(apiUrl("/api/tournaments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateTournamentPayload(s)),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.tournamentId) {
        router.push(`/instructor/tournaments/${d.tournamentId}`);
        return;
      }
      setSubmitError(tournamentErrorMessage(d, "Chưa tạo được đấu trường. Vui lòng thử lại."));
    } catch {
      setSubmitError(tournamentErrorMessage({ error: "network_error" }));
    } finally {
      setBusy(false);
    }
  }

  const sectionTitle = "border-b border-token pb-2 text-base font-semibold";

  return (
    <form onSubmit={onSubmit} className="card space-y-8" noValidate>
      {/* 1. Thông tin */}
      <section className="space-y-4">
        <h2 className={sectionTitle}>1. Thông tin</h2>
        <div id="ct-title">
          <label className={labelCls} htmlFor="t-title">Tên đấu trường</label>
          <input
            id="t-title"
            value={s.title}
            onChange={(e) => { set({ title: e.target.value }); clear("title"); }}
            maxLength={200}
            placeholder="Ví dụ: Đại số sprint tháng 10"
            className="input w-full"
          />
          {errors.title && <p className={errCls}>{errors.title}</p>}
        </div>

        <div id="ct-description">
          <label className={labelCls}>Mô tả</label>
          <RichTextEditor
            value={s.description}
            onChange={(v: string) => { set({ description: v }); clear("description"); }}
            placeholder="Mục tiêu của đấu trường, luật chơi, cách tính điểm."
          />
          {errors.description ? (
            <p className={errCls}>{errors.description}</p>
          ) : (
            <p className={hintCls}>Học viên đọc phần này ở trang đấu trường trước khi đăng ký.</p>
          )}
        </div>

        <div id="ct-courseId">
          <label className={labelCls} htmlFor="t-course">Khoá học</label>
          <select
            id="t-course"
            value={s.courseId}
            onChange={(e) => { set({ courseId: e.target.value }); clear("courseId"); }}
            className="select w-full"
          >
            <option value="">Chọn khoá học</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
            {canCreatePlatformWide && <option value="PLATFORM">Toàn hệ thống (chỉ quản trị viên)</option>}
          </select>
          {errors.courseId ? (
            <p className={errCls}>{errors.courseId}</p>
          ) : (
            <p className={hintCls}>
              Đấu trường gắn với khoá học thì XP thưởng cộng vào khoá đó.
              {canCreatePlatformWide && " Giải toàn hệ thống hiện chưa trao XP thưởng."}
            </p>
          )}
        </div>
      </section>

      {/* 2. Thời gian */}
      <section className="space-y-4">
        <h2 className={sectionTitle}>2. Thời gian (giờ Việt Nam)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div id="ct-startsAt">
            <label className={labelCls} htmlFor="t-start">Bắt đầu</label>
            <input
              id="t-start"
              type="datetime-local"
              value={s.startsAt}
              onChange={(e) => {
                const startsAt = e.target.value;
                // Giữ nguyên độ dài đã chọn khi dời giờ bắt đầu.
                set({ startsAt, ...(durationDays ? { endsAt: endFromDuration(startsAt, durationDays) } : {}) });
                clear("startsAt", "endsAt");
                setWarnings({});
              }}
              className="input w-full"
            />
            {errors.startsAt && <p className={errCls}>{errors.startsAt}</p>}
            {!errors.startsAt && warnings.startsAt && <p className="mt-1.5 text-sm text-warning-700">{warnings.startsAt}</p>}
          </div>
          <div id="ct-endsAt">
            <label className={labelCls} htmlFor="t-end">Kết thúc</label>
            <input
              id="t-end"
              type="datetime-local"
              value={s.endsAt}
              onChange={(e) => { set({ endsAt: e.target.value }); clear("endsAt"); }}
              className="input w-full"
            />
            {errors.endsAt && <p className={errCls}>{errors.endsAt}</p>}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted">Kéo dài</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.days}
                type="button"
                aria-pressed={durationDays === d.days}
                onClick={() => { set({ endsAt: endFromDuration(s.startsAt, d.days) }); clear("endsAt"); }}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  durationDays === d.days
                    ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "border-token bg-[rgb(var(--surface))] hover:border-brand-400"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Cách thi */}
      <section className="space-y-4">
        <h2 className={sectionTitle}>3. Cách thi</h2>
        <div id="ct-teamSize" className="space-y-2">
          {([
            { id: "solo", label: "Cá nhân", desc: "Mỗi học viên thi và xếp hạng riêng." },
            { id: "team", label: "Theo đội", desc: "Học viên lập đội, điểm cả đội cộng dồn. Đội trưởng nộp bài chung." },
          ] as const).map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={s.mode === o.id}
              onClick={() => { set({ mode: o.id }); clear("teamSize"); }}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                s.mode === o.id
                  ? "border-brand-400 bg-brand-50 dark:bg-brand-900/30"
                  : "border-token bg-[rgb(var(--surface))] hover:border-brand-400"
              }`}
            >
              <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${s.mode === o.id ? "border-brand-600 bg-brand-600" : "border-token"}`} aria-hidden />
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="block text-sm text-muted">{o.desc}</span>
              </span>
            </button>
          ))}
          {s.mode === "team" && (
            <div className="max-w-[240px] pl-1 pt-1">
              <label className={labelCls} htmlFor="t-team">Mỗi đội tối đa bao nhiêu người</label>
              <input
                id="t-team"
                type="number"
                min={2}
                max={10}
                value={s.teamSize}
                onChange={(e) => { set({ teamSize: e.target.value }); clear("teamSize"); }}
                className="input w-full"
              />
              {errors.teamSize ? (
                <p className={errCls}>{errors.teamSize}</p>
              ) : (
                <p className={hintCls}>Không đổi được sau khi công bố.</p>
              )}
            </div>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 hover:border-brand-300">
          <input
            type="checkbox"
            checked={s.allowLateRegistration}
            onChange={(e) => set({ allowLateRegistration: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span className="text-sm">
            <span className="font-medium">Cho phép đăng ký khi giải đang diễn ra</span>
            <span className="mt-0.5 block text-xs text-muted">
              Bật: học viên vào được đến lúc giải kết thúc. Tắt: khoá danh sách ngay khi giải bắt đầu, đội không đổi thành viên nữa.
            </span>
          </span>
        </label>
      </section>

      {s.mode === "team" && (
        <section className="space-y-3">
          <h2 className={sectionTitle}>4. Bài nộp của các đội</h2>
          <ShowcaseModePicker value={s.showcaseMode} onChange={(v) => set({ showcaseMode: v })} />
        </section>
      )}

      <div className="border-t border-token pt-4">
        <p className="text-sm text-muted">
          Sau khi tạo, bạn thêm nhiệm vụ, chia giải thưởng rồi công bố. Học viên chưa thấy đấu trường cho tới khi bạn công bố.
        </p>
        {submitError && (
          <p className="mt-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
            {submitError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <Link href="/instructor/tournaments" className="btn-ghost">Huỷ</Link>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Đang tạo…" : "Tạo đấu trường"}
          </button>
        </div>
      </div>
    </form>
  );
}
