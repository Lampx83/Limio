import {
  getPaymentEnabled,
  getRegisterEnabled,
  getFooterSettings,
  getAiBankSettings,
  getLimioSignatureUrl,
  getLimioSignatureMeta,
} from "@/lib/site-settings";
import {
  VIRTUAL_LECTURERS,
  VIRTUAL_LECTURER_MODES,
  VIRTUAL_LECTURER_MODE_LABELS,
  getVirtualLecturerSettings,
} from "@feedbackme/core-lms";
import SettingsClient from "./SettingsClient";
import VirtualLecturerSettings from "./VirtualLecturerSettings";

const MODE_HINTS: Record<(typeof VIRTUAL_LECTURER_MODES)[number], string> = {
  BAT_BUOC: "Mở slide là vào thẳng chế độ có giảng viên; học viên không tắt được.",
  HIEN: "Có thanh mời «Học với giảng viên ảo»; học viên tắt được.",
  TU_BAT: "Mặc định tắt; học viên bấm nút «Bật giảng viên ảo» nếu muốn.",
  AN: "Không có giảng viên ảo. Giảng viên của khoá vẫn xem thử được.",
};

export const revalidate = 30;

export default async function AdminSettingsPage() {
  const [paymentEnabled, registerEnabled, footer, bank, signatureUrl, signatureMeta, virtualLecturer] =
    await Promise.all([
      getPaymentEnabled(),
      getRegisterEnabled(),
      getFooterSettings(),
      getAiBankSettings(),
      getLimioSignatureUrl(),
      getLimioSignatureMeta(),
      getVirtualLecturerSettings(),
    ]);

  return (
    <div>
      <div className="mb-6">
        <span className="chip-brand">Admin</span>
        <h1 className="mt-3 h-display text-2xl font-bold">Cài đặt hệ thống</h1>
        <p className="mt-1 text-sm text-muted">Cấu hình toàn cục — chỉ admin mới thấy trang này.</p>
      </div>

      <SettingsClient
        initialPaymentEnabled={paymentEnabled}
        initialRegisterEnabled={registerEnabled}
        initialFooterText={footer.text}
        initialFooterEnabled={footer.enabled}
        initialBank={bank}
        initialSignatureUrl={signatureUrl}
        initialSignatureName={signatureMeta.name}
        initialSignatureTitle={signatureMeta.title}
      />

      <VirtualLecturerSettings
        initialEnabled={virtualLecturer.enabled}
        initialMode={virtualLecturer.defaultMode}
        initialLecturer={virtualLecturer.defaultLecturer}
        modes={VIRTUAL_LECTURER_MODES.map((value) => ({
          value,
          label: VIRTUAL_LECTURER_MODE_LABELS[value],
          hint: MODE_HINTS[value],
        }))}
        lecturers={VIRTUAL_LECTURERS.map((l) => ({ code: l.code, name: l.name }))}
      />
    </div>
  );
}
