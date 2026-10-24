import { describe, expect, it } from "vitest";
import { codeFeedback, codeMeetingNote } from "../coding";

/**
 * B9.1 nhóm 2 — classifier thuần, không chạm DB.
 */

const base = {
  templateScope: null,
  misconceptionCode: null,
  remediationCount: 0,
} as const;

describe("codeFeedback — meso layers", () => {
  it("AC-2.3: every delivery is task-level, even the bare fallback", () => {
    const c = codeFeedback({ ...base });
    expect(c.levels).toContain("task");
    expect(c.level).toBe("task");
  });

  it("AC-2.1: a matched misconception adds the process layer", () => {
    const c = codeFeedback({
      ...base,
      templateScope: "per_misconception",
      misconceptionCode: "confused_correlation_with_causation",
    });
    expect(c.levels).toEqual(["task", "process"]);
    expect(c.level).toBe("process");
    expect(c.sourceKind).toBe("misconception");
  });

  it("AC-2.1: a skill-scoped template counts as process without a misconception", () => {
    const c = codeFeedback({ ...base, templateScope: "per_skill" });
    expect(c.levels).toContain("process");
    expect(c.sourceKind).toBe("rule_template");
  });

  it("AC-2.2 / AC-2.5: remediation reaches self-regulation and dominates", () => {
    const c = codeFeedback({
      ...base,
      templateScope: "per_misconception",
      misconceptionCode: "mc",
      remediationCount: 2,
    });
    expect(c.levels).toEqual(["task", "process", "self_regulation"]);
    expect(c.level).toBe("self_regulation");
  });

  it("AC-2.4: `self` is never emitted, whatever the inputs", () => {
    const inputs = [
      { ...base },
      { ...base, templateScope: "generic" as const },
      { ...base, misconceptionCode: "mc", remediationCount: 3 },
    ];
    for (const i of inputs) {
      expect(codeFeedback(i).levels).not.toContain("self");
    }
  });
});

describe("codeFeedback — micro ladder (AC-2.6)", () => {
  it("kr: fallback sentence only", () => {
    expect(codeFeedback({ ...base }).elaboration).toBe("kr");
  });

  it("kcr: a template body, nothing deeper", () => {
    expect(
      codeFeedback({ ...base, templateScope: "generic" }).elaboration,
    ).toBe("kcr");
  });

  it("kh: routed somewhere, but no explanation of the mistake", () => {
    expect(
      codeFeedback({ ...base, templateScope: "generic", remediationCount: 1 })
        .elaboration,
    ).toBe("kh");
  });

  it("km: the mistake is explained, but no next step offered", () => {
    expect(
      codeFeedback({
        ...base,
        templateScope: "per_misconception",
        misconceptionCode: "mc",
      }).elaboration,
    ).toBe("km");
  });

  it("elaborated: mistake explained and a next step given", () => {
    expect(
      codeFeedback({
        ...base,
        templateScope: "per_misconception",
        misconceptionCode: "mc",
        remediationCount: 1,
      }).elaboration,
    ).toBe("elaborated");
  });
});

describe("codeFeedback — instructor declarations (AC-2.8)", () => {
  it("a declared level and elaboration override inference", () => {
    const c = codeFeedback({
      ...base,
      templateScope: "generic",
      declaredLevel: "self_regulation",
      declaredElaboration: "elaborated",
    });
    expect(c.level).toBe("self_regulation");
    expect(c.elaboration).toBe("elaborated");
  });

  it("`levels` still reports what was composed, so a wrong declaration is visible", () => {
    const c = codeFeedback({
      ...base,
      templateScope: "generic",
      declaredLevel: "self_regulation",
    });
    // Declared self-regulation, but nothing routed the learner anywhere.
    expect(c.levels).toEqual(["task"]);
    expect(c.level).toBe("self_regulation");
  });
});

describe("codeMeetingNote — nhận xét sau buổi (C4.15)", () => {
  it("chỉ có kết quả bài tập hoặc ghi chú tay: tầng nhiệm vụ, kr, rule_template", () => {
    expect(codeMeetingNote({ source: "manual", hasMasteryStatements: false, remediationCount: 0 })).toEqual({
      level: "task", levels: ["task"], elaboration: "kr", sourceKind: "rule_template",
    });
  });

  it("nói được mức nắm từng phần: thêm tầng quá trình, km, nguồn bkt_state", () => {
    expect(codeMeetingNote({ source: "rule_template", hasMasteryStatements: true, remediationCount: 0 })).toEqual({
      level: "process", levels: ["task", "process"], elaboration: "km", sourceKind: "bkt_state",
    });
  });

  it("chỉ ra bài cần ôn: lên tự điều chỉnh; cả hai thì elaborated", () => {
    expect(codeMeetingNote({ source: "rule_template", hasMasteryStatements: false, remediationCount: 2 })).toMatchObject({ level: "self_regulation", elaboration: "kh" });
    expect(codeMeetingNote({ source: "rule_template", hasMasteryStatements: true, remediationCount: 2 })).toMatchObject({
      level: "self_regulation", levels: ["task", "process", "self_regulation"], elaboration: "elaborated",
    });
  });

  it("AI soạn và giáo viên duyệt là hybrid; không bao giờ phát tầng 'self'", () => {
    for (const source of ["llm", "rule_template", "manual"]) {
      for (const m of [true, false]) for (const r of [0, 1]) {
        const c = codeMeetingNote({ source, hasMasteryStatements: m, remediationCount: r });
        expect(c.levels).not.toContain("self");
        expect(c.level).not.toBe("self");
      }
    }
    expect(codeMeetingNote({ source: "llm", hasMasteryStatements: false, remediationCount: 0 }).sourceKind).toBe("hybrid");
  });
});
