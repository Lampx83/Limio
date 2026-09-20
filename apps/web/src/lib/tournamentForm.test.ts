import { describe, expect, it } from "vitest";
import {
  buildCreateTournamentPayload,
  defaultTournamentForm,
  endFromDuration,
  validateTournamentForm,
  type TournamentFormState,
} from "./tournamentForm";

const NOW = new Date("2026-09-20T02:00:00Z"); // 09:00 giờ VN

function form(over: Partial<TournamentFormState> = {}): TournamentFormState {
  return {
    ...defaultTournamentForm(NOW, "c1"),
    title: "Đại số sprint",
    description: "<p>Luật chơi</p>",
    ...over,
  };
}

describe("defaultTournamentForm", () => {
  it("bắt đầu 8h sáng ngày mai, kéo dài 1 tuần, cá nhân", () => {
    const f = defaultTournamentForm(NOW, "c1");
    expect(f.startsAt).toBe("2026-09-21T08:00");
    expect(f.endsAt).toBe("2026-09-28T08:00");
    expect(f.mode).toBe("solo");
    expect(f.teamSize).toBe("3");
    expect(f.courseId).toBe("c1");
  });

  it("không chọn sẵn khoá khi không có khoá mặc định", () => {
    expect(defaultTournamentForm(NOW, "").courseId).toBe("");
  });
});

describe("endFromDuration", () => {
  it("cộng số ngày vào lúc bắt đầu", () => {
    expect(endFromDuration("2026-09-21T08:00", 1)).toBe("2026-09-22T08:00");
    expect(endFromDuration("2026-09-21T08:00", 14)).toBe("2026-10-05T08:00");
    expect(endFromDuration("", 7)).toBe("");
  });
});

describe("validateTournamentForm", () => {
  const ctx = { now: NOW };

  it("hợp lệ thì không có lỗi", () => {
    expect(validateTournamentForm(form(), ctx).errors).toEqual({});
  });

  it("tên, mô tả, khoá học bắt buộc", () => {
    const { errors } = validateTournamentForm(form({ title: " ", description: "<p><br></p>", courseId: "" }), ctx);
    expect(errors.title).toBeTruthy();
    expect(errors.description).toBeTruthy();
    expect(errors.courseId).toBeTruthy();
  });

  it("chọn toàn hệ thống rõ ràng thì hợp lệ", () => {
    expect(validateTournamentForm(form({ courseId: "PLATFORM" }), ctx).errors.courseId).toBeUndefined();
  });

  it("kết thúc phải sau bắt đầu và sau hiện tại", () => {
    expect(validateTournamentForm(form({ endsAt: "2026-09-21T08:00" }), ctx).errors.endsAt).toMatch(/sau thời điểm bắt đầu/i);
    expect(validateTournamentForm(form({ startsAt: "2026-09-10T08:00", endsAt: "2026-09-15T08:00" }), ctx).errors.endsAt).toMatch(/đã qua/i);
    expect(validateTournamentForm(form({ startsAt: "", endsAt: "" }), ctx).errors).toMatchObject({
      startsAt: expect.any(String),
      endsAt: expect.any(String),
    });
  });

  it("bắt đầu trong quá khứ chỉ là cảnh báo", () => {
    const r = validateTournamentForm(form({ startsAt: "2026-09-19T08:00", endsAt: "2026-09-28T08:00" }), ctx);
    expect(r.errors.startsAt).toBeUndefined();
    expect(r.warnings.startsAt).toMatch(/đã qua/i);
  });

  it("thi theo đội: số người từ 2 đến 10", () => {
    expect(validateTournamentForm(form({ mode: "team", teamSize: "1" }), ctx).errors.teamSize).toBeTruthy();
    expect(validateTournamentForm(form({ mode: "team", teamSize: "11" }), ctx).errors.teamSize).toBeTruthy();
    expect(validateTournamentForm(form({ mode: "team", teamSize: "abc" }), ctx).errors.teamSize).toBeTruthy();
    expect(validateTournamentForm(form({ mode: "team", teamSize: "4" }), ctx).errors).toEqual({});
    expect(validateTournamentForm(form({ mode: "solo", teamSize: "abc" }), ctx).errors.teamSize).toBeUndefined();
  });
});

describe("buildCreateTournamentPayload", () => {
  it("giờ VN → ISO UTC, cá nhân = teamSize 1, không gửi prizeXp", () => {
    const p = buildCreateTournamentPayload(form());
    expect(p).toMatchObject({
      title: "Đại số sprint",
      startsAt: "2026-09-21T01:00:00.000Z",
      endsAt: "2026-09-28T01:00:00.000Z",
      teamSize: 1,
      allowLateRegistration: true,
      showcaseMode: "after_end",
      courseId: "c1",
    });
    expect(p).not.toHaveProperty("prizeXp");
  });

  it("gửi chế độ showcase giảng viên chọn", () => {
    expect(buildCreateTournamentPayload(form({ showcaseMode: "always" })).showcaseMode).toBe("always");
  });

  it("theo đội dùng số người đã nhập; toàn hệ thống không gửi courseId", () => {
    const p = buildCreateTournamentPayload(form({ mode: "team", teamSize: "4", courseId: "PLATFORM" }));
    expect(p.teamSize).toBe(4);
    expect(p).not.toHaveProperty("courseId");
  });
});
