/**
 * Auth-flow URL builders. Real email sending lives in `../email/templates.ts`
 * (admin-editable templates + Resend wrapper).
 */

/**
 * `callbackUrl` (tuỳ chọn) = trang học viên đang muốn tới lúc đăng ký, vd link
 * mời vào lớp — trang /verify chuyển tiếp nó sang đăng nhập. Không lọc ở đây:
 * phía web lọc open-redirect ở mọi trang đọc tham số này.
 */
export function buildVerificationUrl(baseUrl: string, token: string, callbackUrl?: string): string {
  const url = `${baseUrl}/verify?token=${encodeURIComponent(token)}`;
  return callbackUrl ? `${url}&callbackUrl=${encodeURIComponent(callbackUrl)}` : url;
}

export function buildResetUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/reset?token=${encodeURIComponent(token)}`;
}
