"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

interface InitialSettings {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  leaderboardOptOut: boolean;
  /** Whether the user has a password AuthProvider linked (vs SSO-only). */
  hasPassword: boolean;
}

const PASSWORD_ERROR_VI: Record<string, string> = {
  current_password_incorrect: "Mật khẩu hiện tại không đúng.",
  same_as_current: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  no_password_set:
    "Tài khoản này chưa có mật khẩu (đăng nhập qua Google/Microsoft). Hãy dùng chức năng quên mật khẩu để đặt mật khẩu lần đầu.",
  validation_failed: "Mật khẩu không hợp lệ (tối thiểu 8 ký tự).",
};

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function SettingsForm({ initial }: { initial: InitialSettings }) {
  const router = useRouter();

  // ---- Profile (avatar + display name + privacy) ----
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [optOut, setOptOut] = useState(initial.leaderboardOptOut);
  const [profileSaving, setProfileSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // ---- Password ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function onProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    const res = await fetch(apiUrl("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, leaderboardOptOut: optOut }),
    });
    setProfileSaving(false);
    if (res.ok) {
      toast.success("Đã lưu thay đổi");
      router.refresh();
    } else {
      toast.error("Lưu thất bại", { description: "Vui lòng thử lại." });
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh quá lớn", {
        description: "Tối đa 5 MB. Vui lòng nén hoặc chọn ảnh khác.",
      });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Định dạng không hỗ trợ", {
        description: "Chỉ chấp nhận JPG, PNG, WebP hoặc GIF.",
      });
      return;
    }

    setAvatarUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl("/api/me/avatar", { method: "POST", body: fd });
    setAvatarUploading(false);
    if (res.ok) {
      const data = (await res.json()) as { avatarUrl: string };
      setAvatarUrl(data.avatarUrl);
      toast.success("Đã cập nhật ảnh đại diện");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error("Tải ảnh thất bại", {
        description: typeof data?.error === "string" ? data.error : undefined,
      });
    }
  }

  async function onAvatarRemove() {
    if (!avatarUrl) return;
    if (!confirm("Xóa ảnh đại diện hiện tại?")) return;
    setAvatarUploading(true);
    const res = await fetch(apiUrl("/api/me/avatar", { method: "DELETE" });
    setAvatarUploading(false);
    if (res.ok) {
      setAvatarUrl(null);
      toast.success("Đã xóa ảnh đại diện");
      router.refresh();
    } else {
      toast.error("Xóa thất bại");
    }
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Mật khẩu mới tối thiểu 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setPasswordSaving(true);
    const res = await fetch(apiUrl("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setPasswordSaving(false);
    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Đổi mật khẩu thành công");
    } else {
      const data = await res.json().catch(() => ({}));
      const code = typeof data?.error === "string" ? data.error : "unknown";
      setPasswordError(PASSWORD_ERROR_VI[code] ?? `Không đổi được mật khẩu (${code}).`);
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------- Profile section (avatar + name) ---------- */}
      <form onSubmit={onProfileSubmit} className="card">
        <header className="border-b border-token pb-3">
          <h2 className="text-base font-semibold">Hồ sơ công khai</h2>
          <p className="mt-0.5 text-xs text-muted">
            Thông tin hiển thị trên bảng xếp hạng, bài viết và bình luận của bạn.
          </p>
        </header>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Avatar uploader */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt="Ảnh đại diện"
                  className="h-24 w-24 rounded-full border border-token object-cover shadow-card"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-gradient text-2xl font-semibold text-white shadow-card">
                  {initialsOf(displayName)}
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs font-medium text-white">
                  Đang tải...
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onAvatarChange}
              className="hidden"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="btn-secondary btn-sm"
              >
                {avatarUrl ? "Đổi ảnh" : "Tải ảnh lên"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={onAvatarRemove}
                  disabled={avatarUploading}
                  className="btn-ghost btn-sm text-danger-700 hover:bg-danger-50"
                >
                  Xóa
                </button>
              )}
            </div>
            <p className="max-w-[10rem] text-center text-[11px] text-faint">
              JPG, PNG, WebP hoặc GIF. Tối đa 5 MB.
            </p>
          </div>

          {/* Display name + email */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="label" htmlFor="displayName">
                Tên hiển thị
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={80}
                className="input mt-1.5"
              />
              <span className="help">
                Hiện trên bảng xếp hạng, bình luận và hồ sơ công khai.
              </span>
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={initial.email}
                disabled
                className="input mt-1.5 cursor-not-allowed opacity-60"
              />
              <span className="help">
                Liên hệ quản trị viên nếu cần đổi email đăng nhập.
              </span>
            </div>
          </div>
        </div>

        {/* Save bar inside profile card */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-token pt-4">
          <span className="text-xs text-faint">
            {profileSaving ? "Đang lưu…" : "Tên & quyền riêng tư lưu cùng nút Lưu."}
          </span>
          <button
            type="submit"
            disabled={profileSaving}
            className="btn-primary btn-sm"
          >
            {profileSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>

      {/* ---------- Privacy section ---------- */}
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
              nhận XP và badge bình thường. Lưu thay đổi ở phần Hồ sơ công khai.
            </span>
          </span>
        </label>
      </section>

      {/* ---------- Password section ---------- */}
      <section className="card">
        <header className="border-b border-token pb-3">
          <h2 className="text-base font-semibold">Mật khẩu</h2>
          <p className="mt-0.5 text-xs text-muted">
            {initial.hasPassword
              ? "Đổi mật khẩu định kỳ để bảo vệ tài khoản."
              : "Tài khoản đang dùng đăng nhập SSO. Hãy dùng chức năng quên mật khẩu để đặt mật khẩu lần đầu."}
          </p>
        </header>

        {initial.hasPassword ? (
          <form onSubmit={onPasswordSubmit} className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="currentPassword">
                Mật khẩu hiện tại
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input mt-1.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="newPassword">
                  Mật khẩu mới
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className="input mt-1.5"
                />
                <span className="help">Tối thiểu 8 ký tự.</span>
              </div>
              <div>
                <label className="label" htmlFor="confirmPassword">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className="input mt-1.5"
                />
              </div>
            </div>

            {passwordError && (
              <p className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                {passwordError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-token pt-4">
              <button
                type="submit"
                disabled={
                  passwordSaving ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                className="btn-primary btn-sm"
              >
                {passwordSaving ? "Đang đổi..." : "Đổi mật khẩu"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5">
            <a href="/forgot-password" className="btn-secondary btn-sm inline-flex">
              Đặt mật khẩu qua email
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
