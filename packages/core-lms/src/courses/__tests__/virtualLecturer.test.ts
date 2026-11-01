import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { createCourse } from "../courses";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import {
  VIRTUAL_LECTURERS,
  getEffectiveVirtualLecturer,
  getVirtualLecturerSettings,
  resolveVirtualLecturerMode,
  setCourseVirtualLecturerMode,
  setVirtualLecturerSettings,
  type VirtualLecturerModeValue,
} from "../virtualLecturer";

const BASE = "http://localhost:3000";
const lecturerCode = (i: number) => VIRTUAL_LECTURERS[i]!.code;
const MODES: VirtualLecturerModeValue[] = ["BAT_BUOC", "HIEN", "TU_BAT", "AN"];

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function setup(slug: string) {
  const adminId = await makeUser(`adm-${slug}@e.com`);
  await grantRole(adminId, { targetUserId: adminId, roleName: RoleName.Admin });
  const ownerId = await makeUser(`own-${slug}@e.com`);
  const learnerId = await makeUser(`lrn-${slug}@e.com`);
  const c = await createCourse(ownerId, { title: `Khoá ${slug}`, description: "mô tả", slug });
  return { adminId, ownerId, learnerId, courseId: c.courseId };
}

describe("resolveVirtualLecturerMode — ma trận mức hiệu lực", () => {
  it("công tắc hệ thống tắt → AN, bất kể mức khoá/mặc định và kể cả giảng viên", () => {
    for (const courseMode of [null, ...MODES]) {
      for (const systemDefaultMode of MODES) {
        for (const viewerTeachesCourse of [false, true]) {
          expect(
            resolveVirtualLecturerMode({
              systemEnabled: false,
              systemDefaultMode,
              courseMode,
              viewerTeachesCourse,
            }),
          ).toBe("AN");
        }
      }
    }
  });

  it("mức riêng của khoá thắng mức mặc định hệ thống", () => {
    for (const courseMode of MODES) {
      for (const systemDefaultMode of MODES) {
        expect(
          resolveVirtualLecturerMode({
            systemEnabled: true,
            systemDefaultMode,
            courseMode,
            viewerTeachesCourse: false,
          }),
        ).toBe(courseMode);
      }
    }
  });

  it("khoá không đặt mức riêng (null) → theo mặc định hệ thống", () => {
    for (const systemDefaultMode of MODES) {
      expect(
        resolveVirtualLecturerMode({
          systemEnabled: true,
          systemDefaultMode,
          courseMode: null,
          viewerTeachesCourse: false,
        }),
      ).toBe(systemDefaultMode);
    }
  });

  it("giảng viên xem khoá mình dạy không bị «Không hiện» che — nhưng không bị ép", () => {
    expect(
      resolveVirtualLecturerMode({
        systemEnabled: true,
        systemDefaultMode: "HIEN",
        courseMode: "AN",
        viewerTeachesCourse: true,
      }),
    ).toBe("TU_BAT");
    // Ba mức còn lại giữ nguyên với giảng viên.
    for (const m of ["BAT_BUOC", "HIEN", "TU_BAT"] as const) {
      expect(
        resolveVirtualLecturerMode({
          systemEnabled: true,
          systemDefaultMode: "AN",
          courseMode: m,
          viewerTeachesCourse: true,
        }),
      ).toBe(m);
    }
  });
});

describe("cài đặt giảng viên ảo của hệ thống", () => {
  it("mặc định: tắt, mức «Hiện», giảng viên đầu danh sách", async () => {
    const s = await getVirtualLecturerSettings();
    expect(s).toEqual({
      enabled: false,
      defaultMode: "HIEN",
      defaultLecturer: "mai-chi",
    });
  });

  it("chỉ admin lưu được; người khác bị từ chối và giá trị không đổi", async () => {
    const s = await setup("vl1");
    await expect(setVirtualLecturerSettings(s.ownerId, { enabled: true })).rejects.toMatchObject({
      message: "forbidden",
    });
    await expect(setVirtualLecturerSettings(s.learnerId, { enabled: true })).rejects.toMatchObject({
      message: "forbidden",
    });
    expect((await getVirtualLecturerSettings()).enabled).toBe(false);

    await setVirtualLecturerSettings(s.adminId, {
      enabled: true,
      defaultMode: "TU_BAT",
      defaultLecturer: lecturerCode(2),
    });
    expect(await getVirtualLecturerSettings()).toEqual({
      enabled: true,
      defaultMode: "TU_BAT",
      defaultLecturer: lecturerCode(2),
    });
  });

  it("từ chối mã giảng viên không có trong danh sách", async () => {
    const s = await setup("vl2");
    await expect(
      setVirtualLecturerSettings(s.adminId, { defaultLecturer: "khong-ton-tai" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("ghi AuditLog cho lần đổi thật, không ghi khi lưu lại giá trị cũ", async () => {
    const s = await setup("vl3");
    await setVirtualLecturerSettings(s.adminId, { enabled: true });
    await setVirtualLecturerSettings(s.adminId, { enabled: true });
    const rows = await prisma.auditLog.findMany({
      where: { action: "virtual_lecturer.settings.changed", actorUserId: s.adminId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toEqual({ changes: { enabled: { from: false, to: true } } });
  });
});

describe("mức riêng của khoá", () => {
  it("chỉ admin đặt được; null xoá mức riêng; ghi AuditLog chỉ mang id và giá trị cũ/mới", async () => {
    const s = await setup("vl4");
    await expect(
      setCourseVirtualLecturerMode(s.ownerId, s.courseId, "BAT_BUOC"),
    ).rejects.toMatchObject({ message: "forbidden" });

    await setCourseVirtualLecturerMode(s.adminId, s.courseId, "BAT_BUOC");
    await setCourseVirtualLecturerMode(s.adminId, s.courseId, "BAT_BUOC"); // lưu lại: không phải sự kiện
    await setCourseVirtualLecturerMode(s.adminId, s.courseId, null);

    const course = await prisma.course.findUniqueOrThrow({ where: { id: s.courseId } });
    expect(course.virtualLecturerMode).toBeNull();

    const rows = await prisma.auditLog.findMany({
      where: { action: "course.virtual_lecturer.changed" },
      orderBy: { occurredAt: "asc" },
    });
    expect(rows.map((r) => r.payload)).toEqual([
      { courseId: s.courseId, from: null, to: "BAT_BUOC" },
      { courseId: s.courseId, from: "BAT_BUOC", to: null },
    ]);
  });

  it("khoá không tồn tại → not_found", async () => {
    const s = await setup("vl5");
    await expect(
      setCourseVirtualLecturerMode(s.adminId, "00000000-0000-4000-8000-000000000000", "HIEN"),
    ).rejects.toMatchObject({ message: "not_found" });
  });
});

describe("getEffectiveVirtualLecturer — trang và API cùng gọi một chỗ", () => {
  it("hệ thống tắt → AN; bật + khoá BAT_BUOC → học viên bị ép, giảng viên cũng thấy", async () => {
    const s = await setup("vl6");
    const off = await getEffectiveVirtualLecturer(s.courseId, s.learnerId);
    expect(off.mode).toBe("AN");

    await setVirtualLecturerSettings(s.adminId, { enabled: true });
    await setCourseVirtualLecturerMode(s.adminId, s.courseId, "BAT_BUOC");
    expect((await getEffectiveVirtualLecturer(s.courseId, s.learnerId)).mode).toBe("BAT_BUOC");
    expect((await getEffectiveVirtualLecturer(s.courseId, s.ownerId)).mode).toBe("BAT_BUOC");
  });

  it("khoá «Không hiện»: học viên và khách thấy AN, chủ khoá vẫn xem thử được", async () => {
    const s = await setup("vl7");
    await setVirtualLecturerSettings(s.adminId, { enabled: true });
    await setCourseVirtualLecturerMode(s.adminId, s.courseId, "AN");
    expect((await getEffectiveVirtualLecturer(s.courseId, s.learnerId)).mode).toBe("AN");
    expect((await getEffectiveVirtualLecturer(s.courseId, null)).mode).toBe("AN");
    expect((await getEffectiveVirtualLecturer(s.courseId, s.ownerId)).mode).toBe("TU_BAT");
  });

  it("trả về giảng viên mặc định của hệ thống", async () => {
    const s = await setup("vl8");
    await setVirtualLecturerSettings(s.adminId, {
      enabled: true,
      defaultLecturer: lecturerCode(3),
    });
    const e = await getEffectiveVirtualLecturer(s.courseId, s.learnerId);
    expect(e.lecturerCode).toBe(lecturerCode(3));
  });
});
