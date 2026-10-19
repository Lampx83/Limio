import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

/** LANG L1.3 — đổi chế độ ứng dụng: đặt cookie hiển thị rồi chuyển hướng; không cấp quyền, không mở redirect ra ngoài. */

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/app-mode${qs}`));
const cookieOf = (res: Response) => res.headers.get("set-cookie") ?? "";

describe("GET /api/app-mode", () => {
  it("to=language: đặt cookie limio_app=language và chuyển tới /language (mặc định)", async () => {
    const res = await call("?to=language");
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/language");
    expect(cookieOf(res)).toContain("limio_app=language");
    expect(cookieOf(res)).toMatch(/Path=\//i);
    expect(cookieOf(res)).toMatch(/SameSite=lax/i);
  });
  it("to=default: đặt cookie default và về trang chủ (mặc định)", async () => {
    const res = await call("?to=default");
    expect(cookieOf(res)).toContain("limio_app=default");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });
  it("giữ nguyên trang đang xem khi có next hợp lệ (kể cả query)", async () => {
    const res = await call(`?to=default&next=${encodeURIComponent("/me/skills?tab=1")}`);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname + loc.search).toBe("/me/skills?tab=1");
  });
  it("next ra ngoài (open redirect) bị bỏ, dùng trang mặc định", async () => {
    for (const next of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
      const res = await call(`?to=language&next=${encodeURIComponent(next)}`);
      const loc = new URL(res.headers.get("location")!);
      expect(loc.origin).toBe("http://localhost:3000");
      expect(loc.pathname).toBe("/language");
    }
  });
  it("to thiếu hoặc lạ → 400, không đặt cookie", async () => {
    for (const qs of ["", "?to=admin", "?to="]) {
      const res = await call(qs);
      expect(res.status).toBe(400);
      expect(cookieOf(res)).toBe("");
    }
  });
  it("cookie sống lâu (ghi nhớ lựa chọn) và KHÔNG HttpOnly vì chỉ là tuỳ chọn hiển thị", async () => {
    const res = await call("?to=language");
    expect(cookieOf(res)).toMatch(/Max-Age=\d{6,}/i);
    expect(cookieOf(res)).not.toMatch(/HttpOnly/i);
  });
});
