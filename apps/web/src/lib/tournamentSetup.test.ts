import { describe, expect, it } from "vitest";
import { buildSetupSteps } from "./tournamentSetup";

const base = {
  status: "draft",
  title: "Đại số sprint",
  description: "<p>Luật chơi</p>",
  startsAt: new Date("2026-10-01T01:00:00Z"),
  endsAt: new Date("2026-10-15T16:00:00Z"),
  missionCount: 0,
  prizeXp: 0,
  prizeDistribution: null as unknown,
  judgeCount: 0,
};

const byId = (r: ReturnType<typeof buildSetupSteps>, id: string) => r.steps.find((s) => s.id === id)!;

describe("buildSetupSteps", () => {
  it("giải mới tạo: thiếu nhiệm vụ nên chưa sẵn sàng công bố", () => {
    const r = buildSetupSteps(base);
    expect(byId(r, "info").state).toBe("done");
    expect(byId(r, "missions").state).toBe("todo");
    expect(byId(r, "prize").state).toBe("optional");
    expect(byId(r, "judges").state).toBe("optional");
    expect(r.readyToPublish).toBe(false);
    expect(byId(r, "publish").state).toBe("todo");
  });

  it("có nhiệm vụ và không có thưởng: sẵn sàng công bố", () => {
    const r = buildSetupSteps({ ...base, missionCount: 2 });
    expect(byId(r, "missions")).toMatchObject({ state: "done", hint: "2 nhiệm vụ" });
    expect(r.readyToPublish).toBe(true);
  });

  it("có XP thưởng mà chưa chia: bước thưởng là việc cần làm và chặn công bố", () => {
    const r = buildSetupSteps({ ...base, missionCount: 1, prizeXp: 500 });
    expect(byId(r, "prize").state).toBe("todo");
    expect(byId(r, "prize").hint).toMatch(/chia/i);
    expect(r.readyToPublish).toBe(false);
  });

  it("chia thưởng đủ thì xong; vượt 100% vẫn là việc cần làm", () => {
    const ok = buildSetupSteps({ ...base, missionCount: 1, prizeXp: 500, prizeDistribution: { "1": 60, "2": 40 } });
    expect(byId(ok, "prize").state).toBe("done");
    expect(ok.readyToPublish).toBe(true);
    const over = buildSetupSteps({ ...base, missionCount: 1, prizeXp: 500, prizeDistribution: { "1": 70, "2": 50 } });
    expect(byId(over, "prize").state).toBe("todo");
  });

  it("giám khảo là tuỳ chọn, có thì hiện số lượng", () => {
    const r = buildSetupSteps({ ...base, missionCount: 1, judgeCount: 2 });
    expect(byId(r, "judges")).toMatchObject({ state: "done", hint: "2 giám khảo" });
    expect(r.readyToPublish).toBe(true);
  });

  it("thiếu mô tả hoặc thời gian sai: bước thông tin chưa xong", () => {
    expect(byId(buildSetupSteps({ ...base, description: "<p><br></p>" }), "info").state).toBe("todo");
    expect(byId(buildSetupSteps({ ...base, endsAt: new Date("2026-09-01T00:00:00Z") }), "info").state).toBe("todo");
  });

  it("đã công bố: bước công bố xong", () => {
    expect(byId(buildSetupSteps({ ...base, status: "published", missionCount: 1 }), "publish").state).toBe("done");
  });
});
