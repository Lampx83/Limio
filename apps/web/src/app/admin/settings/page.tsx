import { getPaymentEnabled, getFooterSettings } from "@/lib/site-settings";
import SettingsClient from "./SettingsClient";

export const revalidate = 30;

export default async function AdminSettingsPage() {
  const [paymentEnabled, footer] = await Promise.all([
    getPaymentEnabled(),
    getFooterSettings(),
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
        initialFooterText={footer.text}
        initialFooterEnabled={footer.enabled}
      />
    </div>
  );
}
