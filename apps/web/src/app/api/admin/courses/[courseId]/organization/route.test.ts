import { beforeEach, describe, expect, it, vi } from "vitest";
import { CourseOrgError } from "@feedbackme/core-lms";

/** Gắn khoá vào tổ chức (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC8): chỉ Platform Admin; body kiểm chặt. */

const { requireAdmin, setCourseOrganization } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  setCourseOrganization: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireAdmin }));
vi.mock("@feedbackme/core-lms", async (importActual) => {
  const actual = await importActual<typeof import("@feedbackme/core-lms")>();
  return { ...actual, setCourseOrganization };
});

const patch = (body: unknown) =>
  import("./route").then(({ PATCH }) =>
    PATCH(
      new Request("http://x/api/admin/courses/c-1/organization", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: { courseId: "c-1" } },
    ),
  );

describe("PATCH /api/admin/courses/[courseId]/organization", () => {
  beforeEach(() => {
    requireAdmin.mockReset().mockResolvedValue("admin-1");
    setCourseOrganization.mockReset().mockResolvedValue({ changed: true });
  });

  it("không phải admin → 403, không đổi", async () => {
    requireAdmin.mockResolvedValue(null);
    expect((await patch({ organizationId: "o-1" })).status).toBe(403);
    expect(setCourseOrganization).not.toHaveBeenCalled();
  });

  it("body sai → 400", async () => {
    expect((await patch({ organizationId: 5 })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ organizationId: "" })).status).toBe(400);
    expect(setCourseOrganization).not.toHaveBeenCalled();
  });

  it("gắn và gỡ (null) đều gọi lõi", async () => {
    expect((await patch({ organizationId: "o-1" })).status).toBe(200);
    expect(setCourseOrganization).toHaveBeenLastCalledWith("admin-1", "c-1", "o-1");
    expect((await patch({ organizationId: null })).status).toBe(200);
    expect(setCourseOrganization).toHaveBeenLastCalledWith("admin-1", "c-1", null);
  });

  it("tổ chức không có → 404", async () => {
    setCourseOrganization.mockRejectedValue(new CourseOrgError("org_not_found"));
    expect((await patch({ organizationId: "x" })).status).toBe(404);
  });
});
