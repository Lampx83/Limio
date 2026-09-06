import { describe, expect, it } from "vitest";
import { codeFeedback } from "../coding";

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
