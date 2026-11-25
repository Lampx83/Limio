"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatPrice } from "@/lib/formatPrice";

export interface BankTransferInfo {
  orderId: string;
  /** Mã thanh toán = nội dung chuyển khoản. */
  code: string;
  amountCents: number;
  currency: string;
  bank: string;
  accountNumber: string;
  accountHolder: string;
  qrUrl: string;
}

const POLL_MS = 4000;
const GIVE_UP_MS = 30 * 60_000;

/**
 * Khung chuyển khoản VietQR (docs/tieu-chi/thanh-toan-sepay.md, AC4): ảnh QR đã điền sẵn số tiền và nội dung, thông tin
 * dạng chữ có nút sao chép (phòng khi ảnh không tải được), và tự hỏi trạng thái đơn tới khi tiền về. Quyền học chỉ do
 * webhook cấp; ở đây chỉ chờ và chuyển trang.
 */
export default function BankTransferPanel({
  info,
  fallbackRedirect,
  onClose,
}: {
  info: BankTransferInfo;
  /** Nơi chuyển tới khi đơn không gắn một khoá cụ thể (combo): thường là /me. */
  fallbackRedirect: string;
  onClose?: () => void;
}) {
  const [paid, setPaid] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    let stopped = false;
    const startedAt = Date.now();
    async function tick() {
      if (stopped) return;
      try {
        const res = await fetch(apiUrl(`/api/orders/${info.orderId}/status`), { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { status?: string; bundle?: boolean; courseSlug?: string | null };
          if (d.status === "paid") {
            setPaid(true);
            stopped = true;
            const to = !d.bundle && d.courseSlug ? `/learn/${d.courseSlug}?paid=1` : fallbackRedirect;
            setTimeout(() => {
              window.location.href = to;
            }, 1500);
            return;
          }
        }
      } catch {
        // mạng chập chờn: thử lại ở lần sau
      }
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setGaveUp(true);
        return;
      }
      setTimeout(tick, POLL_MS);
    }
    const t = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [info.orderId, fallbackRedirect]);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      // Một số trình duyệt từ chối: người dùng vẫn chọn chữ và sao chép tay được.
    }
  }

  const Row = ({ label, value, copyValue, mono }: { label: string; value: string; copyValue?: string; mono?: boolean }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`min-w-0 break-all text-right font-semibold ${mono ? "font-mono tracking-wide" : ""}`}>{value}</span>
        {copyValue && (
          <button type="button" onClick={() => void copy(label, copyValue)} className="shrink-0 text-xs text-brand-600 hover:underline">
            {copied === label ? "Đã chép" : "Chép"}
          </button>
        )}
      </span>
    </div>
  );

  if (paid) {
    return (
      <div role="status" className="rounded-xl border border-success-200 bg-success-50 px-4 py-6 text-center">
        <p className="font-semibold text-success-700">Đã nhận được tiền. Đang mở khoá học cho bạn…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-token p-4" data-testid="bank-transfer-panel">
      <p className="font-semibold">Chuyển khoản để kích hoạt</p>
      {!qrFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info.qrUrl}
          alt="Mã VietQR đã điền sẵn số tiền và nội dung"
          onError={() => setQrFailed(true)}
          className="mx-auto h-56 w-56 rounded-lg border border-token bg-white object-contain"
        />
      )}
      <div className="divide-y divide-[color:var(--border,#e5e7eb)]">
        <Row label="Ngân hàng" value={info.bank} />
        <Row label="Số tài khoản" value={info.accountNumber} copyValue={info.accountNumber} mono />
        {info.accountHolder && <Row label="Chủ tài khoản" value={info.accountHolder} />}
        <Row label="Số tiền" value={formatPrice(info.amountCents, info.currency)} copyValue={String(info.amountCents)} />
        <Row label="Nội dung" value={info.code} copyValue={info.code} mono />
      </div>
      <p className="text-xs text-muted">
        Giữ nguyên <strong>nội dung</strong> và <strong>số tiền</strong>. Tiền về, hệ thống tự kích hoạt trong vài giây; trang này sẽ tự chuyển.
      </p>
      {gaveUp && (
        <p role="alert" className="text-xs text-danger-600">
          Chưa thấy tiền về. Nếu đã chuyển khoản, hãy liên hệ Limio kèm nội dung chuyển khoản <span className="font-mono">{info.code}</span>.
        </p>
      )}
      {onClose && (
        <button type="button" onClick={onClose} className="text-xs text-muted underline-offset-2 hover:underline">
          Quay lại
        </button>
      )}
    </div>
  );
}
