"use client";

import { useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

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
  initialFooterText,
  initialFooterEnabled,
  initialBank,
}: {
  initialPaymentEnabled: boolean;
  initialFooterText: string;
  initialFooterEnabled: boolean;
  initialBank: BankSettings;
}) {
  const [paymentEnabled, setPaymentEnabled] = useState(initialPaymentEnabled);
  const [footerText, setFooterText] = useState(initialFooterText);
  const [footerEnabled, setFooterEnabled] = useState(initialFooterEnabled);
  const [savedFooterText, setSavedFooterText] = useState(initialFooterText);
  const [bank, setBank] = useState(initialBank);
  const [savedBank, setSavedBank] = useState(initialBank);
  const [pending, startTransition] = useTransition();

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

  return (
    <div className="space-y-6">
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
