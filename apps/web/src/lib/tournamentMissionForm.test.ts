import { describe, expect, it } from "vitest";
import {
  addDaysToInput,
  buildMissionPayload,
  defaultMissionForm,
  deadlinePresets,
  modeOfMission,
  peerSummary,
  stateFromMission,
  validateMissionForm,
  type FormContext,
  type MissionFormState,
} from "./tournamentMissionForm";

const ctx: FormContext = {
  now: new Date("2026-09-20T02:00:00Z"), // 09:00 VN
  tournamentStart: new Date("2026-10-01T01:00:00Z"), // 08:00 VN
  tournamentEnd: new Date("2026-10-15T16:00:00Z"), // 23:00 VN
  teamSize: 1,
  template: null,
  unchangedDeadline: null,
};

function form(over: Partial<MissionFormState>): MissionFormState {
  return { ...defaultMissionForm(), title: "Bài 1", description: "<p>Làm bài</p>", ...over };
}

describe("validateMissionForm", () => {
  it("bước 1: bắt buộc chọn cách làm", () => {
    expect(validateMissionForm(1, defaultMissionForm(), ctx).mode).toBeTruthy();
    expect(validateMissionForm(1, form({ mode: "quiz" }), ctx)).toEqual({});
  });

  it("bước 2: tên, hướng dẫn (bỏ thẻ rỗng), điểm ≥ 0", () => {
    const e = validateMissionForm(2, form({ mode: "quiz", title: "  ", description: "<p><br></p>", points: "-1" }), ctx);
    expect(e.title).toBeTruthy();
    expect(e.description).toBeTruthy();
    expect(e.points).toBeTruthy();
    expect(validateMissionForm(2, form({ mode: "quiz", points: "0" }), ctx)).toEqual({});
  });

  it("bước 2: nhiệm vụ ở trang khác cần link hợp lệ", () => {
    expect(validateMissionForm(2, form({ mode: "manual", external: true, externalUrl: "abc" }), ctx).externalUrl).toBeTruthy();
    expect(validateMissionForm(2, form({ mode: "manual", external: true, externalUrl: "https://a.com/x" }), ctx)).toEqual({});
  });

  it("bước 2 (tự tính theo khoá): cần mẫu điều kiện và ngưỡng theo mẫu", () => {
    const base = form({ mode: "course" });
    expect(validateMissionForm(2, base, ctx).templateId).toBeTruthy();
    const withTpl = form({ mode: "course", templateId: "t1", conditionValue: "3", conditionMinScore: "0" });
    const c2 = { ...ctx, template: { hasMinScore: true, requiresSkillGroup: true } };
    const e = validateMissionForm(2, withTpl, c2);
    expect(e.conditionMinScore).toBeTruthy();
    expect(e.conditionSkillCode).toBeTruthy();
  });

  it("bước 3: hạn nộp bắt buộc, sau hiện tại, trong thời gian giải", () => {
    const m = (deadline: string) => validateMissionForm(3, form({ mode: "quiz", deadline }), ctx).deadline;
    expect(m("")).toBeTruthy();
    expect(m("2026-09-19T10:00")).toMatch(/sau thời điểm hiện tại/i);
    expect(m("2026-09-25T10:00")).toMatch(/trước lúc giải bắt đầu/i);
    expect(m("2026-10-16T10:00")).toMatch(/sau lúc giải kết thúc/i);
    expect(m("2026-10-08T23:59")).toBeUndefined();
  });

  it("bước 3: hạn không đổi thì không bị bắt lỗi thời gian (sửa nhiệm vụ cũ)", () => {
    const c = { ...ctx, unchangedDeadline: "2026-09-25T10:00" };
    expect(validateMissionForm(3, form({ mode: "quiz", deadline: "2026-09-25T10:00" }), c).deadline).toBeUndefined();
  });

  it("nhiệm vụ tự tính theo khoá không cần hạn nộp", () => {
    expect(validateMissionForm(3, form({ mode: "course" }), ctx).deadline).toBeUndefined();
  });

  it("chấm chéo: số lượt chốt ≤ số bạn chấm, tiêu chí không rỗng, hạn chấm sau hạn nộp", () => {
    const peer = form({
      mode: "peer",
      deadline: "2026-10-08T23:59",
      reviewers: "2",
      quorum: "3",
      peerPass: "60",
      reviewWindowEndAt: "2026-10-08T10:00",
      rubric: [{ id: "a", label: " ", scale: "1-5", weight: 1 }],
    });
    const e = validateMissionForm(3, peer, ctx);
    expect(e.quorum).toMatch(/không được lớn hơn/i);
    expect(e.rubric).toBeTruthy();
    expect(e.reviewWindowEndAt).toBeTruthy();
    const ok = { ...peer, quorum: "2", rubric: [{ id: "a", label: "Nội dung", scale: "1-5" as const, weight: 2 }], reviewWindowEndAt: "2026-10-11T23:59" };
    expect(validateMissionForm(3, ok, ctx)).toEqual({});
  });

  it("kiểm tra tự động: cần chữ liên kết hoặc ít nhất một loại tệp", () => {
    expect(validateMissionForm(3, form({ mode: "check", deadline: "2026-10-08T23:59", checkKind: "link", checkLinkText: "" }), ctx).checkLinkText).toBeTruthy();
    expect(validateMissionForm(3, form({ mode: "check", deadline: "2026-10-08T23:59", checkKind: "file", checkFileTypes: [] }), ctx).checkFileTypes).toBeTruthy();
    expect(validateMissionForm(3, form({ mode: "check", deadline: "2026-10-08T23:59", checkKind: "file", checkFileTypes: ["pdf"] }), ctx)).toEqual({});
  });
});

describe("buildMissionPayload", () => {
  const add = { teamSize: 1, kind: "add" as const };

  it("bài kiểm tra → CUSTOM + AUTO_GRADE, hạn nộp đổi từ giờ VN sang UTC", () => {
    const p = buildMissionPayload(form({ mode: "quiz", deadline: "2026-10-08T23:59", points: "0" }), add);
    expect(p).toMatchObject({ missionType: "CUSTOM", verifyMode: "AUTO_GRADE", points: 0, submissionDeadline: "2026-10-08T16:59:00.000Z" });
    expect(p).not.toHaveProperty("rubric");
  });

  it("nộp bài giảng viên chấm: có passThreshold mặc định; làm ở trang khác → EXTERNAL + url", () => {
    const p = buildMissionPayload(form({ mode: "manual", deadline: "2026-10-08T23:59", external: true, externalUrl: "https://a.com" }), add);
    expect(p).toMatchObject({ missionType: "EXTERNAL", verifyMode: "MANUAL_REVIEW", passThreshold: 0.6, contentPayload: { url: "https://a.com" } });
  });

  it("chấm chéo: phần trăm → 0..1, rubric, hạn chấm; không bao giờ EXTERNAL", () => {
    const p = buildMissionPayload(
      form({
        mode: "peer",
        external: true,
        deadline: "2026-10-08T23:59",
        reviewers: "3",
        quorum: "2",
        peerPass: "75",
        reviewWindowEndAt: "2026-10-11T23:59",
        rubric: [{ id: "c1", label: "Nội dung", scale: "1-5", weight: 2 }],
      }),
      add,
    );
    expect(p).toMatchObject({
      missionType: "CUSTOM",
      verifyMode: "PEER_REVIEW",
      peerReviewerCount: 3,
      reviewQuorum: 2,
      passThreshold: 0.75,
      reviewWindowEndAt: "2026-10-11T16:59:00.000Z",
      rubric: [{ id: "c1", label: "Nội dung", scale: "1-5", weight: 2 }],
    });
  });

  it("kiểm tra liên kết → url_pattern (escape ký tự đặc biệt); kiểm tra tệp → danh sách MIME", () => {
    const link = buildMissionPayload(form({ mode: "check", deadline: "2026-10-08T23:59", checkKind: "link", checkLinkText: "github.com" }), add);
    expect(link.autoCheckRule).toEqual({ type: "url_pattern", config: { regex: "github\\.com" } });
    const file = buildMissionPayload(form({ mode: "check", deadline: "2026-10-08T23:59", checkKind: "file", checkFileTypes: ["pdf", "image"] }), add);
    expect((file.autoCheckRule as { config: { mime: string[] } }).config.mime).toEqual(
      expect.arrayContaining(["application/pdf", "image/png", "image/jpeg"]),
    );
  });

  it("cấu hình kiểm tra nâng cao có sẵn (regex tuỳ ý, webhook) được giữ nguyên", () => {
    const raw = { type: "webhook", config: { endpoint: "https://x.y/hook" } };
    const p = buildMissionPayload(form({ mode: "check", deadline: "2026-10-08T23:59", checkKind: "raw", checkRaw: raw }), add);
    expect(p.autoCheckRule).toEqual(raw);
  });

  it("tự tính theo khoá → COURSE_LINKED, không có hạn nộp hay verifyMode", () => {
    const p = buildMissionPayload(
      form({ mode: "course", templateId: "t1", conditionValue: "3", conditionMinScore: "80", conditionScope: "global" }),
      add,
    );
    expect(p).toMatchObject({ missionType: "COURSE_LINKED", templateId: "t1", conditionValue: 3, conditionMinScore: 80, conditionScope: "global" });
    expect(p).not.toHaveProperty("verifyMode");
    expect(p).not.toHaveProperty("submissionDeadline");
  });

  it("nộp chung theo đội chỉ gửi khi giải theo đội và không phải bài kiểm tra", () => {
    const base = { mode: "manual" as const, deadline: "2026-10-08T23:59", isTeamSubmission: true };
    expect(buildMissionPayload(form(base), { teamSize: 3, kind: "add" }).isTeamSubmission).toBe(true);
    expect(buildMissionPayload(form(base), { teamSize: 1, kind: "add" }).isTeamSubmission).toBeUndefined();
    expect(buildMissionPayload(form({ ...base, mode: "quiz" }), { teamSize: 3, kind: "add" }).isTeamSubmission).toBeUndefined();
  });

  it("sửa: không gửi missionType/verifyMode; tiên quyết rỗng → null", () => {
    const p = buildMissionPayload(form({ mode: "quiz", deadline: "2026-10-08T23:59", prerequisiteId: "" }), { teamSize: 1, kind: "edit" });
    expect(p).not.toHaveProperty("missionType");
    expect(p).not.toHaveProperty("verifyMode");
    expect(p.prerequisiteId).toBeNull();
  });

  it("sửa nhiệm vụ tự tính theo khoá: chỉ gửi điều kiện khi được phép", () => {
    const s = form({ mode: "course", templateId: "t1", conditionValue: "5" });
    const locked = buildMissionPayload(s, { teamSize: 1, kind: "edit", editConditions: false });
    expect(locked).not.toHaveProperty("conditionValue");
    const open = buildMissionPayload(s, { teamSize: 1, kind: "edit", editConditions: true });
    expect(open).toMatchObject({ conditionValue: 5 });
  });
});

describe("stateFromMission / modeOfMission", () => {
  it("đọc lại đúng cách làm và giá trị (giờ VN, phần trăm)", () => {
    const m = {
      title: "T",
      description: "<p>x</p>",
      points: 50,
      prerequisiteId: null,
      missionType: "CUSTOM" as const,
      verifyMode: "PEER_REVIEW" as const,
      submissionDeadline: "2026-10-08T16:59:00.000Z",
      reviewWindowEndAt: "2026-10-11T16:59:00.000Z",
      passThreshold: 0.75,
      peerReviewerCount: 3,
      reviewQuorum: 2,
      rubric: [{ id: "a", label: "Nội dung", scale: "1-5" as const, weight: 2 }],
    };
    expect(modeOfMission(m)).toBe("peer");
    const s = stateFromMission(m);
    expect(s).toMatchObject({ mode: "peer", deadline: "2026-10-08T23:59", peerPass: "75", reviewers: "3", quorum: "2", points: "50" });
    expect(s.reviewWindowEndAt).toBe("2026-10-11T23:59");
  });

  it("nhận diện tệp/liên kết đơn giản; cấu hình lạ chuyển thành raw", () => {
    const base = { title: "T", description: "d", points: 1, prerequisiteId: null, missionType: "CUSTOM" as const, verifyMode: "AUTO_CHECK" as const, submissionDeadline: "2026-10-08T16:59:00.000Z" };
    expect(stateFromMission({ ...base, autoCheckRule: { type: "url_pattern", config: { regex: "github\\.com" } } })).toMatchObject({ checkKind: "link", checkLinkText: "github.com" });
    expect(stateFromMission({ ...base, autoCheckRule: { type: "file_format", config: { mime: ["application/pdf"] } } })).toMatchObject({ checkKind: "file", checkFileTypes: ["pdf"] });
    expect(stateFromMission({ ...base, autoCheckRule: { type: "url_pattern", config: { regex: "^https://.*\\.edu$" } } }).checkKind).toBe("raw");
    expect(stateFromMission({ ...base, autoCheckRule: { type: "webhook", config: { endpoint: "https://x" } } }).checkKind).toBe("raw");
  });

  it("nhiệm vụ không có verifyMode là tự tính theo khoá", () => {
    expect(modeOfMission({ missionType: "COURSE_LINKED", verifyMode: null })).toBe("course");
  });
});

describe("tiện ích", () => {
  it("tóm tắt chấm chéo bằng lời", () => {
    const s = form({ mode: "peer", reviewers: "2", quorum: "2", peerPass: "60" });
    expect(peerSummary(s)).toBe(
      "Mỗi bài có 2 bạn chấm, chốt điểm khi có ít nhất 2 lượt, đạt khi điểm trung bình từ 60%. Tiêu chí: Nội dung, Trình bày.",
    );
  });

  it("cộng ngày theo giờ VN", () => {
    expect(addDaysToInput("2026-10-08T23:59", 3)).toBe("2026-10-11T23:59");
  });

  it("mốc hạn nộp nhanh nằm trong thời gian giải và sau hiện tại", () => {
    const presets = deadlinePresets(ctx.tournamentStart, ctx.tournamentEnd, ctx.now);
    expect(presets.length).toBeGreaterThanOrEqual(2);
    for (const p of presets) {
      const iso = new Date(`${p.value}:00+07:00`);
      expect(iso >= ctx.tournamentStart && iso <= ctx.tournamentEnd && iso > ctx.now).toBe(true);
    }
    expect(presets[presets.length - 1]!.value).toBe("2026-10-15T23:00");
  });
});
