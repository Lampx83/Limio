"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;
const ALLOWED_SIGNATURE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-brand-600" : "bg-[rgb(var(--surface-muted))]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

interface BankSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export default function SettingsClient({
  initialPaymentEnabled,
  initialRegisterEnabled,
  initialFooterText,
  initialFooterEnabled,
  initialBank,
  initialSignatureUrl,
  initialSignatureName,
  initialSignatureTitle,
}: {
  initialPaymentEnabled: boolean;
  initialRegisterEnabled: boolean;
  initialFooterText: string;
  initialFooterEnabled: boolean;
  initialBank: BankSettings;
  initialSignatureUrl: string | null;
  initialSignatureName: string;
  initialSignatureTitle: string;
}) {
  const [paymentEnabled, setPaymentEnabled] = useState(initialPaymentEnabled);
  const [registerEnabled, setRegisterEnabled] = useState(initialRegisterEnabled);
  const [footerText, setFooterText] = useState(initialFooterText);
  const [footerEnabled, setFooterEnabled] = useState(initialFooterEnabled);
  const [savedFooterText, setSavedFooterText] = useState(initialFooterText);
  const [bank, setBank] = useState(initialBank);
  const [savedBank, setSavedBank] = useState(initialBank);
  const [pending, startTransition] = useTransition();
  const [signatureUrl, setSignatureUrl] = useState(initialSignatureUrl);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [signatureName, setSignatureName] = useState(initialSignatureName);
  const [signatureTitle, setSignatureTitle] = useState(initialSignatureTitle);
  const [savedSignatureName, setSavedSignatureName] = useState(initialSignatureName);
  const [savedSignatureTitle, setSavedSignatureTitle] = useState(initialSignatureTitle);
  const [savingSignatureMeta, setSavingSignatureMeta] = useState(false);
  const signatureMetaDirty =
    signatureName !== savedSignatureName || signatureTitle !== savedSignatureTitle;

  async function saveSignatureMeta() {
    setSavingSignatureMeta(true);
    const res = await fetch(apiUrl("/api/admin/branding/signature"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: signatureName.trim(), title: signatureTitle.trim() }),
    });
    setSavingSignatureMeta(false);
    if (res.ok) {
      setSavedSignatureName(signatureName.trim());
      setSavedSignatureTitle(signatureTitle.trim());
      setSignatureName(signatureName.trim());
      setSignatureTitle(signatureTitle.trim());
      toast.success("Đã lưu tên/chức danh người ký");
    } else {
      toast.error("Lưu thất bại");
    }
  }

  async function onSignatureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SIGNATURE_BYTES) {
      toast.error("Ảnh quá lớn", { description: "Tối đa 5 MB." });
      return;
    }
    if (!ALLOWED_SIGNATURE_MIME.includes(file.type)) {
      toast.error("Định dạng không hỗ trợ", { description: "Chỉ chấp nhận JPG, PNG, WebP hoặc GIF." });
      return;
    }
    setUploadingSignature(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl("/api/admin/branding/signature"), { method: "POST", body: fd });
    setUploadingSignature(false);
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      setSignatureUrl(data.url);
      toast.success("Đã cập nhật chữ ký Limio");
    } else {
      toast.error("Tải ảnh thất bại");
    }
  }

  async function onSignatureRemove() {
    if (!signatureUrl) return;
    if (!confirm("Xoá ảnh chữ ký Limio hiện tại?")) return;
    setUploadingSignature(true);
    const res = await fetch(apiUrl("/api/admin/branding/signature"), { method: "DELETE" });
    setUploadingSignature(false);
    if (res.ok) {
      setSignatureUrl(null);
      toast.success("Đã xoá chữ ký Limio");
    } else {
      toast.error("Xoá thất bại");
    }
  }

  const footerDirty = footerText !== savedFooterText;
  const bankDirty =
    bank.bankName !== savedBank.bankName ||
    bank.accountNumber !== savedBank.accountNumber ||
    bank.accountName !== savedBank.accountName;

  async function patchSettings(body: Record<string, string>) {
    const res = await fetch(apiUrl("/api/admin/settings"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  function toggleFooterEnabled(val: boolean) {
    setFooterEnabled(val);
    startTransition(async () => {
      const ok = await patchSettings({ "footer.enabled": val ? "true" : "false" });
      if (!ok) {
        setFooterEnabled(!val);
        toast.error("Cập nhật thất bại", { description: "Vui lòng thử lại." });
      } else {
        toast.success(val ? "Đã bật footer" : "Đã tắt footer");
      }
    });
  }

  function saveFooterText() {
    const trimmed = footerText.trim();
    if (trimmed.length > 500) {
      toast.error("Nội dung quá dài", { description: "Tối đa 500 ký tự." });
      return;
    }
    startTransition(async () => {
      const ok = await patchSettings({ "footer.text": trimmed });
      if (!ok) {
        toast.error("Cập nhật thất bại", { description: "Vui lòng thử lại." });
      } else {
        setSavedFooterText(trimmed);
        setFooterText(trimmed);
        toast.success("Đã lưu nội dung footer");
      }
    });
  }

  function saveBank() {
    const trimmed: BankSettings = {
      bankName: bank.bankName.trim(),
      accountNumber: bank.accountNumber.trim(),
      accountName: bank.accountName.trim(),
    };
    // Số tài khoản người ta hay dán kèm khoảng trắng hoặc dấu chấm từ app ngân
    // hàng; bỏ hết để hiện ra một chuỗi liền, đúng cái người mua sẽ gõ lại.
    trimmed.accountNumber = trimmed.accountNumber.replace(/[\s.]/g, "");
    startTransition(async () => {
      const ok = await patchSettings({
        "ai.bank.name": trimmed.bankName,
        "ai.bank.account_number": trimmed.accountNumber,
        "ai.bank.account_name": trimmed.accountName,
      });
      if (!ok) {
        toast.error("Cập nhật thất bại", { description: "Vui lòng thử lại." });
        return;
      }
      setBank(trimmed);
      setSavedBank(trimmed);
      toast.success("Đã lưu thông tin tài khoản nhận tiền");
    });
  }

  async function togglePayment(val: boolean) {
    setPaymentEnabled(val);
    startTransition(async () => {
      const res = await fetch(apiUrl("/api/admin/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "payment.enabled": val ? "true" : "false" }),
      });
      if (!res.ok) {
        setPaymentEnabled(!val);
        toast.error("Cập nhật thất bại", { description: "Vui lòng thử lại." });
      } else {
        toast.success(
          val ? "Đã bật hệ thống thanh toán" : "Đã tắt hệ thống thanh toán",
        );
      }
    });
  }

  async function toggleRegister(val: boolean) {
    setRegisterEnabled(val);
    startTransition(async () => {
      const ok = await patchSettings({ "register.enabled": val ? "true" : "false" });
      if (!ok) {
        setRegisterEnabled(!val);
        toast.error("Cập nhật thất bại", { description: "Vui lòng thử lại." });
      } else {
        toast.success(val ? "Đã bật đăng ký tài khoản" : "Đã tắt đăng ký tài khoản");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Đăng ký tài khoản trên trang chủ */}
      <section className="card">
        <header className="border-b border-token pb-4">
          <h2 className="text-base font-semibold">Đăng ký tài khoản</h2>
          <p className="mt-1 text-xs text-muted">
            Nút/mục mời tạo tài khoản mới ở trang chủ, header, footer và trang đăng nhập. Không chặn truy cập trực tiếp trang{" "}
            <code>/register</code> — chỉ ẩn lời mời.
          </p>
        </header>

        <div className="divide-y divide-token">
          <ToggleRow
            label="Hiện mục đăng ký tài khoản"
            description={
              registerEnabled
                ? "Đang bật — các nút mời tạo tài khoản học viên/giáo viên."
                : "Đang tắt — các nút đăng ký bị ẩn khắp nơi, chỉ còn lối vào khám phá khoá học."
            }
            checked={registerEnabled}
            onChange={toggleRegister}
            disabled={pending}
          />
        </div>
      </section>

      {/* Payment section */}
      <section className="card">
        <header className="border-b border-token pb-4">
          <h2 className="text-base font-semibold">Thanh toán & Định giá</h2>
          <p className="mt-1 text-xs text-muted">
            Kiểm soát luồng thanh toán trên toàn hệ thống. Khi tắt, tất cả khoá học đều
            đăng ký miễn phí kể cả có gắn giá — dùng cho giai đoạn build nội dung.
          </p>
        </header>

        <div className="divide-y divide-token">
          <ToggleRow
            label="Bật hệ thống thanh toán"
            description={
              paymentEnabled
                ? "Đang bật — khoá học có phí yêu cầu thanh toán trước khi enroll. Giá hiển thị trên catalog."
                : "Đang tắt — tất cả khoá học enroll miễn phí. Giá không hiển thị trên catalog."
            }
            checked={paymentEnabled}
            onChange={togglePayment}
            disabled={pending}
          />
        </div>

        {paymentEnabled && (
          <div className="mt-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-xs text-warning-800">
            <strong>Gateway chưa tích hợp.</strong> Khoá học có phí sẽ hiện nút "Mua khoá học"
            nhưng thanh toán thực tế chưa hoạt động. Cần cấu hình Stripe/VNPay trước khi thu tiền thật.
          </div>
        )}
      </section>

      {/* Chữ ký đại diện Limio — A6, hiện trên chứng nhận hoàn thành khoá học */}
      <section className="card">
        <header className="border-b border-token pb-4">
          <h2 className="text-base font-semibold">Chữ ký Limio</h2>
          <p className="mt-1 text-xs text-muted">
            Hiện trên chứng nhận hoàn thành khoá học, cạnh chữ ký của Organization (nếu khoá
            thuộc 1 trường). Dùng chung cho toàn hệ thống.
          </p>
        </header>

        <div className="mt-4 flex items-center gap-4 py-2">
          <div className="relative flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface-muted))]">
            {signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureUrl}
                alt="Chữ ký Limio"
                className="h-full w-full rounded-lg object-contain p-2"
              />
            ) : (
              <span className="text-xs text-faint">Chưa có</span>
            )}
            {uploadingSignature && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-[10px] font-medium text-white">
                Đang tải...
              </div>
            )}
          </div>

          <div>
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onSignatureChange}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => signatureInputRef.current?.click()}
                disabled={uploadingSignature}
                className="btn-secondary btn-sm"
              >
                {signatureUrl ? "Đổi chữ ký" : "Tải ảnh chữ ký lên"}
              </button>
              {signatureUrl && (
                <button
                  type="button"
                  onClick={onSignatureRemove}
                  disabled={uploadingSignature}
                  className="btn-ghost btn-sm text-danger-700 hover:bg-danger-50"
                >
                  Xoá
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-faint">
              JPG, PNG, WebP hoặc GIF, nền trong suốt. Tối đa 5 MB.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-token pt-4">
          <div>
            <label className="text-xs font-semibold" htmlFor="sig-name">
              Tên người ký
            </label>
            <input
              id="sig-name"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="mt-1 w-48 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold" htmlFor="sig-title">
              Chức danh
            </label>
            <input
              id="sig-title"
              value={signatureTitle}
              onChange={(e) => setSignatureTitle(e.target.value)}
              placeholder="Nhà sáng lập"
              className="mt-1 w-48 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
          <button
            type="button"
            onClick={saveSignatureMeta}
            disabled={savingSignatureMeta || !signatureMetaDirty}
            className="btn-secondary btn-sm"
          >
            Lưu
          </button>
        </div>
      </section>

      {/* Tài khoản nhận tiền mua token AI */}
      <section className="card">
        <header className="border-b border-token pb-4">
          <h2 className="text-base font-semibold">
            Tài khoản nhận tiền mua token AI
          </h2>
          <p className="mt-1 text-xs text-muted">
            Hiện trên trang <code>/me/ai-tokens</code> để người học chuyển
            khoản. Chưa điền đủ tên ngân hàng và số tài khoản thì trang mua báo
            &ldquo;chưa cấu hình&rdquo; thay vì mời chuyển tiền.
          </p>
        </header>

        <div className="space-y-3 py-4">
          <div>
            <label className="text-sm font-semibold" htmlFor="bank-name">
              Ngân hàng
            </label>
            <input
              id="bank-name"
              value={bank.bankName}
              onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
              placeholder="Vietcombank"
              className="mt-1 w-full rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="bank-number">
              Số tài khoản
            </label>
            <input
              id="bank-number"
              value={bank.accountNumber}
              onChange={(e) =>
                setBank({ ...bank, accountNumber: e.target.value })
              }
              placeholder="0123456789"
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="bank-holder">
              Tên chủ tài khoản
            </label>
            <input
              id="bank-holder"
              value={bank.accountName}
              onChange={(e) =>
                setBank({ ...bank, accountName: e.target.value })
              }
              placeholder="TRUONG DAI HOC ..."
              className="mt-1 w-full rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {bank.bankName.trim() && bank.accountNumber.trim()
                ? "Đã đủ để hiện cho người mua."
                : "Thiếu ngân hàng hoặc số tài khoản — trang mua sẽ báo chưa cấu hình."}
            </span>
            <button
              type="button"
              onClick={saveBank}
              disabled={pending || !bankDirty}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Đang lưu…" : "Lưu"}
            </button>
          </div>

          <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted">
              Người mua sẽ thấy
            </p>
            <p className="mt-1 text-sm">
              {bank.bankName.trim() && bank.accountNumber.trim() ? (
                <>
                  Chuyển tới: <strong>{bank.bankName.trim()}</strong> —{" "}
                  <strong>{bank.accountNumber.trim()}</strong>
                  {bank.accountName.trim() ? ` (${bank.accountName.trim()})` : ""}
                </>
              ) : (
                "Thông tin tài khoản nhận chưa được cấu hình — liên hệ admin trước khi chuyển tiền."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Footer section */}
      <section className="card">
        <header className="border-b border-token pb-4">
          <h2 className="text-base font-semibold">Footer trang công khai</h2>
          <p className="mt-1 text-xs text-muted">
            Dòng thông tin hiển thị ở cuối các trang công khai và trang học viên. Không hiển thị trong
            khu admin / instructor.
          </p>
        </header>

        <div className="divide-y divide-token">
          <ToggleRow
            label="Hiển thị footer"
            description={
              footerEnabled
                ? "Đang bật — footer hiển thị ở cuối các trang."
                : "Đang tắt — footer bị ẩn hoàn toàn."
            }
            checked={footerEnabled}
            onChange={toggleFooterEnabled}
            disabled={pending}
          />

          <div className="py-4">
            <label className="text-sm font-semibold" htmlFor="footer-text">
              Nội dung footer
            </label>
            <p className="mt-0.5 text-xs text-muted">
              Plain text, tối đa 500 ký tự. Hiển thị căn giữa ở cuối trang.
            </p>
            <textarea
              id="footer-text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-2 w-full rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">{footerText.length}/500</span>
              <button
                type="button"
                onClick={saveFooterText}
                disabled={pending || !footerDirty}
                className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Đang lưu…" : "Lưu"}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted">Xem trước</p>
              <p className="mt-1 text-center text-sm text-muted">
                {footerText.trim() || "(trống)"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
