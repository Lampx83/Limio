"use client";

import { useState } from "react";

interface InitialSettings {
  displayName: string;
  locale: string;
  timezone: string;
  leaderboardOptOut: boolean;
}

export default function SettingsForm({ initial }: { initial: InitialSettings }) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [optOut, setOptOut] = useState(initial.leaderboardOptOut);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, leaderboardOptOut: optOut }),
    });
    setStatus(res.ok ? "ok" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 1800);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Profile section */}
      <section className="card">
        <header className="border-b border-token pb-3">
          <h2 className="text-base font-semibold">Hồ sơ công khai</h2>
          <p className="mt-0.5 text-xs text-muted">
            Thông tin hiển thị trên bảng xếp hạng và bài viết của bạn.
          </p>
        </header>

        <div className="mt-5">
          <label className="label" htmlFor="displayName">Tên hiển thị</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={80}
            className="input mt-1.5"
          />
          <span className="help">Hiện trên bảng xếp hạng và nhận xét.</span>
        </div>
      </section>

      {/* Privacy section */}
      <section className="card">
        <header className="border-b border-token pb-3">
          <h2 className="text-base font-semibold">Quyền riêng tư</h2>
          <p className="mt-0.5 text-xs text-muted">
            Kiểm soát mức độ hiển thị của bạn trong cộng đồng.
          </p>
        </header>

        <label className="mt-5 flex cursor-pointer items-start gap-4 rounded-xl border border-token p-4 transition-colors hover:bg-[rgb(var(--surface-muted))]">
          <span className="relative mt-1 inline-flex h-5 w-9 shrink-0 items-center">
            <input
              type="checkbox"
              checked={optOut}
              onChange={(e) => setOptOut(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-[rgb(var(--surface-muted))] transition-colors peer-checked:bg-brand-600" />
            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
          <span className="block">
            <span className="block text-sm font-medium">Ẩn khỏi bảng xếp hạng</span>
            <span className="mt-1 block text-xs text-muted">
              Khi bật, tên bạn không xuất hiện trên bảng xếp hạng tuần. Bạn vẫn
              nhận XP và badge bình thường.
            </span>
          </span>
        </label>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))/0.85] p-3 shadow-card backdrop-blur">
        <div className="text-sm">
          {status === "ok" && (
            <span className="inline-flex items-center gap-1.5 text-success-600">
              <span>✓</span> Đã lưu thay đổi
            </span>
          )}
          {status === "error" && (
            <span className="inline-flex items-center gap-1.5 text-danger-600">
              <span>✕</span> Có lỗi xảy ra, vui lòng thử lại
            </span>
          )}
          {status === "idle" && (
            <span className="text-faint">Thay đổi sẽ được lưu khi bạn nhấn Lưu.</span>
          )}
          {status === "saving" && (
            <span className="text-muted">Đang lưu…</span>
          )}
        </div>
        <button type="submit" disabled={status === "saving"} className="btn-primary">
          {status === "saving" ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
