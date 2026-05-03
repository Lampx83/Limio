import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import { systemAdminNav } from "@/lib/instructor-nav";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;

  const settings = db
    .prepare("SELECT key, value, updated_at FROM system_settings")
    .all() as Array<{ key: string; value: string; updated_at: string }>;
  const settingsMap = Object.fromEntries(
    settings.map((s) => [s.key, { value: s.value, updated_at: s.updated_at }]),
  ) as Record<string, { value: string; updated_at: string } | undefined>;

  const hasKey = !!settingsMap.openai_api_key?.value;
  const isEncrypted = settingsMap.openai_api_key?.value?.startsWith("v1:") ?? false;
  const envKeyExists = !!process.env.OPENAI_API_KEY;

  return (
    <AdminShell
      title="Cấu hình hệ thống"
      fullName={user.full_name}
      role="system_admin"
      nav={systemAdminNav("settings")}
    >
      <h2 className="text-lg font-semibold mb-3">OpenAI API</h2>
      <div className="card p-4 sm:p-5 mb-5">
        <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Key trong DB</p>
            <p className="mt-1">
              {hasKey ? (
                <span className="badge-green">
                  ✓ {isEncrypted ? "Đã mã hoá AES-256-GCM" : "Lưu plain (cũ)"}
                </span>
              ) : (
                <span className="text-slate-400 italic text-sm">Chưa cấu hình</span>
              )}
            </p>
            {settingsMap.openai_api_key?.updated_at && (
              <p className="text-xs text-slate-400 mt-1">
                Cập nhật: {settingsMap.openai_api_key.updated_at}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Fallback từ .env.local</p>
            <p className="font-mono mt-1">
              {envKeyExists ? (
                <span className="text-emerald-600">✓ Có cấu hình</span>
              ) : (
                <span className="text-slate-400 italic">Không có</span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              DB ưu tiên hơn env var
            </p>
          </div>
        </div>

        <SettingsForm
          currentModel={settingsMap.openai_model?.value ?? ""}
        />
      </div>

      <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-sm">
        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
          ⚠ Lưu ý bảo mật
        </p>
        <ul className="text-xs text-amber-900 dark:text-amber-100 space-y-1 list-disc pl-5">
          <li>Key được lưu trong DB cục bộ - chỉ system admin thấy mặt nạ.</li>
          <li>Trên môi trường production, nên dùng secret manager / env var.</li>
          <li>Mỗi lần gọi AI feedback đều tốn token theo bảng giá OpenAI.</li>
        </ul>
      </div>
    </AdminShell>
  );
}
