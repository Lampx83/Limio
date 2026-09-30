/**
 * Tổ chức mặc định cho user đăng nhập SSO — dùng cho server nội bộ một trường
 * (vd limio.hust.edu.vn: ai vào bằng SSO đều là người của Bách Khoa), để admin
 * khỏi gắn organization từng người.
 *
 * Chỉ bật khi server đặt biến môi trường; server khác (limio.vn…) không đặt
 * thì hành vi y nguyên cũ:
 *   SSO_DEFAULT_ORG_CODE=HUST                   mã Organization (bắt buộc để bật)
 *   SSO_DEFAULT_ORG_EMAIL_DOMAINS=hust.edu.vn   tuỳ chọn, phẩy phân cách; có đặt
 *     thì CHỈ email thuộc các tên miền này (kể cả tên miền con) được gắn — chốt
 *     an toàn nếu IdP (Google/Entra) chưa giới hạn tài khoản ngoài trường.
 *
 * Chỉ gắn cho user CHƯA thuộc trường nào, và chỉ lúc tạo tài khoản / lần đầu
 * liên kết SSO (xem sso.ts) — không tự gắn lại ở mỗi lần đăng nhập, để admin
 * gỡ ai đó khỏi trường thì họ không bị kéo về lần sau.
 */
import { prisma } from "@feedbackme/db";
import type { DbClient } from "./tokens";

export interface SsoDefaultOrgConfig {
  code: string;
  domains: string[];
}

export function ssoDefaultOrgConfig(
  env: Record<string, string | undefined> = process.env,
): SsoDefaultOrgConfig | null {
  const code = env.SSO_DEFAULT_ORG_CODE?.trim().toUpperCase();
  if (!code) return null;
  const domains = (env.SSO_DEFAULT_ORG_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return { code, domains };
}

export function emailMatchesDomains(email: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  const host = email.trim().toLowerCase().split("@")[1];
  if (!host) return false;
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** id Organization mặc định cho email này, hoặc null nếu không áp dụng. */
export async function resolveSsoDefaultOrgId(
  email: string,
  db: DbClient = prisma,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const cfg = ssoDefaultOrgConfig(env);
  if (!cfg || !emailMatchesDomains(email, cfg.domains)) return null;
  const org = await db.organization.findUnique({
    where: { code: cfg.code },
    select: { id: true },
  });
  if (!org) {
    // Cấu hình sai không được làm hỏng đăng nhập — chỉ báo để admin sửa.
    console.warn(`[sso] SSO_DEFAULT_ORG_CODE=${cfg.code} không khớp Organization nào — bỏ qua`);
    return null;
  }
  return org.id;
}
