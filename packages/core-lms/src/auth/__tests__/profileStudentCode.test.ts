import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { ProfileError, updateProfile } from "../profile";

async function newUser(email: string) {
  return prisma.user.create({ data: { email, displayName: "SV" } });
}

describe("updateProfile — mã số sinh viên", () => {
  it("lưu mã đã cắt khoảng trắng", async () => {
    const u = await newUser("sv-code-1@example.com");
    await updateProfile(u.id, { studentCode: "  11224567 " });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).studentCode).toBe("11224567");
  });

  it("chuỗi rỗng xoá mã", async () => {
    const u = await newUser("sv-code-2@example.com");
    await updateProfile(u.id, { studentCode: "11224567" });
    await updateProfile(u.id, { studentCode: "" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).studentCode).toBeNull();
  });

  it("không gửi studentCode thì giữ nguyên", async () => {
    const u = await newUser("sv-code-3@example.com");
    await updateProfile(u.id, { studentCode: "11224567" });
    await updateProfile(u.id, { displayName: "Tên mới" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).studentCode).toBe("11224567");
  });

  it("từ chối mã quá dài", async () => {
    const u = await newUser("sv-code-4@example.com");
    await expect(updateProfile(u.id, { studentCode: "x".repeat(33) })).rejects.toBeInstanceOf(ProfileError);
  });
});
