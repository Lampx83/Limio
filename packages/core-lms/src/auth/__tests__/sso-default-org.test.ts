import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  emailMatchesDomains,
  resolveSsoDefaultOrgId,
  ssoDefaultOrgConfig,
} from "../ssoDefaultOrg";
import { loginOrLinkSso } from "../sso";

describe("ssoDefaultOrgConfig / emailMatchesDomains (thuần)", () => {
  it("không đặt code = tắt; code viết hoa, domain chuẩn hoá", () => {
    expect(ssoDefaultOrgConfig({})).toBeNull();
    expect(ssoDefaultOrgConfig({ SSO_DEFAULT_ORG_CODE: "  " })).toBeNull();
    expect(
      ssoDefaultOrgConfig({
        SSO_DEFAULT_ORG_CODE: "hust",
        SSO_DEFAULT_ORG_EMAIL_DOMAINS: " @HUST.edu.vn , sis.hust.edu.vn ",
      }),
    ).toEqual({ code: "HUST", domains: ["hust.edu.vn", "sis.hust.edu.vn"] });
  });

  it("khớp tên miền con nhưng không khớp đuôi giả", () => {
    const d = ["hust.edu.vn"];
    expect(emailMatchesDomains("a@hust.edu.vn", d)).toBe(true);
    expect(emailMatchesDomains("a@sis.hust.edu.vn", d)).toBe(true);
    expect(emailMatchesDomains("a@evilhust.edu.vn", d)).toBe(false);
    expect(emailMatchesDomains("a@gmail.com", d)).toBe(false);
    expect(emailMatchesDomains("a@gmail.com", [])).toBe(true); // không đặt domain = không lọc
  });
});

async function mkOrg(slug: string) {
  return prisma.organization.create({
    data: { code: `SSO${slug}${Date.now()}`.toUpperCase(), name: "BK" },
  });
}

describe("loginOrLinkSso + trường mặc định", () => {
  const sso = (email: string, sub: string) => ({
    provider: "google" as const,
    providerUserId: sub,
    email,
    name: "N",
    emailVerifiedByProvider: true,
  });

  it("user SSO mới được gắn trường mặc định khi email khớp; email ngoài tên miền thì không", async () => {
    const org = await mkOrg("a");
    process.env.SSO_DEFAULT_ORG_CODE = org.code;
    process.env.SSO_DEFAULT_ORG_EMAIL_DOMAINS = "hust.edu.vn";
    try {
      const inside = await loginOrLinkSso(sso(`in-${Date.now()}@hust.edu.vn`, `g-in-${Date.now()}`));
      const outside = await loginOrLinkSso(sso(`out-${Date.now()}@gmail.com`, `g-out-${Date.now()}`));
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: inside!.id } })).organizationId,
      ).toBe(org.id);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: outside!.id } })).organizationId,
      ).toBeNull();
    } finally {
      delete process.env.SSO_DEFAULT_ORG_CODE;
      delete process.env.SSO_DEFAULT_ORG_EMAIL_DOMAINS;
    }
  });

  it("tài khoản sẵn có (chưa trường) được gắn khi liên kết SSO lần đầu; đã thuộc trường khác thì giữ nguyên", async () => {
    const org = await mkOrg("b");
    const other = await mkOrg("c");
    const t = Date.now();
    const free = await prisma.user.create({ data: { email: `free-${t}@hust.edu.vn`, displayName: "F" } });
    const owned = await prisma.user.create({
      data: { email: `owned-${t}@hust.edu.vn`, displayName: "O", organizationId: other.id },
    });
    process.env.SSO_DEFAULT_ORG_CODE = org.code;
    try {
      await loginOrLinkSso(sso(free.email, `g-f-${t}`));
      await loginOrLinkSso(sso(owned.email, `g-o-${t}`));
      expect((await prisma.user.findUniqueOrThrow({ where: { id: free.id } })).organizationId).toBe(org.id);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: owned.id } })).organizationId).toBe(other.id);
    } finally {
      delete process.env.SSO_DEFAULT_ORG_CODE;
    }
  });

  it("đăng nhập lại không kéo về trường nếu admin đã gỡ; chưa đặt biến = không gắn; code sai = không hỏng đăng nhập", async () => {
    const org = await mkOrg("d");
    const t = Date.now();
    process.env.SSO_DEFAULT_ORG_CODE = org.code;
    const first = await loginOrLinkSso(sso(`rm-${t}@hust.edu.vn`, `g-rm-${t}`));
    await prisma.user.update({ where: { id: first!.id }, data: { organizationId: null } }); // admin gỡ
    await loginOrLinkSso(sso(`rm-${t}@hust.edu.vn`, `g-rm-${t}`)); // đăng nhập lại (đã có link)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: first!.id } })).organizationId).toBeNull();

    delete process.env.SSO_DEFAULT_ORG_CODE;
    const off = await loginOrLinkSso(sso(`off-${t}@hust.edu.vn`, `g-off-${t}`));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: off!.id } })).organizationId).toBeNull();

    process.env.SSO_DEFAULT_ORG_CODE = "KHONG-TON-TAI";
    try {
      expect(await resolveSsoDefaultOrgId(`x-${t}@hust.edu.vn`)).toBeNull();
      const bad = await loginOrLinkSso(sso(`bad-${t}@hust.edu.vn`, `g-bad-${t}`));
      expect(bad).not.toBeNull();
    } finally {
      delete process.env.SSO_DEFAULT_ORG_CODE;
    }
  });
});
