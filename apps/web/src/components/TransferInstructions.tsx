/**
 * Hướng dẫn mua khi CHƯA có cổng thanh toán (docs/tieu-chi/combo-khoa-hoc.md, AC8): chuyển khoản rồi nhập mã kích hoạt.
 * Nội dung chuyển khoản (số tài khoản, tên, nội dung) do admin đặt trong cài đặt `payment.transfer_instructions`; thiếu
 * thì hiện lời nhắn chung, không bịa thông tin ngân hàng.
 */
export default function TransferInstructions({ text }: { text?: string | null }) {
  const body = text?.trim();
  return (
    <div className="rounded-xl border border-token bg-base-50 px-4 py-3 text-sm" data-testid="transfer-instructions">
      <p className="font-semibold">Cách mua</p>
      <p className="mt-1 whitespace-pre-line text-muted">
        {body || "Liên hệ Limio để mua và nhận mã kích hoạt, rồi nhập mã vào ô bên dưới."}
      </p>
      {body && <p className="mt-2 text-xs text-faint">Sau khi chuyển khoản, bạn nhận một mã kích hoạt. Nhập mã vào ô bên dưới là học được ngay.</p>}
    </div>
  );
}
