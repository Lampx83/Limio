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
import { getLegacyOralReadiness, listIntegrationStatuses } from "@feedbackme/core-lms";
import HashTabs from "../_components/HashTabs";
import IntegrationsManager from "../integrations/IntegrationsManager";
import SettingsClient from "./SettingsClient";
import LegacyOralSwitch from "./LegacyOralSwitch";
import VirtualLecturerSettings from "./VirtualLecturerSettings";

const MODE_HINTS: Record<(typeof VIRTUAL_LECTURER_MODES)[number], string> = {
  BAT_BUOC: "Mở slide là vào thẳng chế độ có giảng viên; học viên không tắt được.",
  HIEN: "Có thanh mời «Học với giảng viên ảo»; học viên tắt được.",
  TU_BAT: "Mặc định tắt; học viên bấm nút «Bật giảng viên ảo» nếu muốn.",
  AN: "Không có giảng viên ảo. Giảng viên của khoá vẫn xem thử được.",
};

export const revalidate = 30;

export default async function AdminSettingsPage() {
  const [paymentEnabled, registerEnabled, footer, bank, signatureUrl, signatureMeta, virtualLecturer, legacyOral, integrations] =
    await Promise.all([
      getPaymentEnabled(),
      getRegisterEnabled(),
      getFooterSettings(),
      getAiBankSettings(),
      getLimioSignatureUrl(),
      getLimioSignatureMeta(),
      getVirtualLecturerSettings(),
      getLegacyOralReadiness(),
      listIntegrationStatuses(),
    ]);

  const settingsProps = {
    initialPaymentEnabled: paymentEnabled,
    initialRegisterEnabled: registerEnabled,
    initialFooterText: footer.text,
    initialFooterEnabled: footer.enabled,
    initialBank: bank,
    initialSignatureUrl: signatureUrl,
    initialSignatureName: signatureMeta.name,
    initialSignatureTitle: signatureMeta.title,
  };

  const tabIntro = (text: string) => <p className="text-sm text-muted">{text}</p>;

  return (
    <div>
      <div className="mb-2">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">Cài đặt hệ thống</h1>
        <p className="mt-1 text-sm text-muted">
          Cấu hình toàn cục và khoá tích hợp, chia theo chủ đề. Chỉ Platform Admin thấy trang này.
        </p>
      </div>

      <HashTabs
        label="Các nhóm cài đặt"
        tabs={[
          {
            id: "chung",
            label: "Chung",
            content: (
              <>
                {tabIntro("Đăng ký tài khoản, chữ ký trên chứng nhận và dòng chữ cuối trang.")}
                <SettingsClient part="general" {...settingsProps} />
              </>
            ),
          },
          {
            id: "hoc-tap",
            label: "Học tập",
            content: (
              <>
                {tabIntro("Giảng viên ảo mặc định và vấn đáp AI bản cũ.")}
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
                <LegacyOralSwitch initial={legacyOral} />
              </>
            ),
          },
          {
            id: "thanh-toan",
            label: "Thanh toán",
            content: (
              <>
                {tabIntro("Công tắc thanh toán toàn hệ thống, tài khoản nhận tiền mua token AI và khoá của từng cổng thanh toán.")}
                <SettingsClient part="payment" {...settingsProps} />
                <div>
                  <h2 className="mb-1 text-base font-semibold">Cổng thanh toán</h2>
                  <p className="mb-3 text-xs text-muted">Bấm vào từng cổng để nhập hoặc đổi khoá.</p>
                  <IntegrationsManager initialStatuses={integrations} topic="payment" />
                </div>
              </>
            ),
          },
          {
            id: "ai",
            label: "AI & giọng nói",
            content: (
              <>
                {tabIntro("Khoá cho trợ giảng AI, chuyển chữ thành giọng nói, phân tích tiếng nói và tìm trên internet.")}
                <IntegrationsManager initialStatuses={integrations} topic="ai" />
              </>
            ),
          },
          {
            id: "phan-tich",
            label: "Phân tích",
            content: (
              <>
                {tabIntro("Google Analytics 4 cho số liệu truy cập trên Dashboard.")}
                <IntegrationsManager initialStatuses={integrations} topic="analytics" />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
