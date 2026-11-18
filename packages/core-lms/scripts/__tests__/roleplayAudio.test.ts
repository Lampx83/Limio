import { describe, expect, it } from "vitest";
import { fillRoleplayAudio, roleplaySpeakable, roleVoices } from "../roleplay-audio";

describe("roleplaySpeakable", () => {
  it("bỏ pinyin ghi sau chữ Hán cuối", () => {
    expect(roleplaySpeakable("我的行李怎么还没出来？是不是丢了？ Wǒ de xínglǐ zěnme hái méi chūlái? Shì bùshì diūle")).toBe("我的行李怎么还没出来？是不是丢了？");
  });
  it("giữ chữ Latin xen giữa câu", () => {
    expect(roleplaySpeakable("我用App订票。")).toBe("我用App订票。");
  });
  it("câu không có chữ Hán giữ nguyên", () => {
    expect(roleplaySpeakable("Hello there… friend")).toBe("Hello there friend");
  });
});

describe("roleVoices — bảng giọng cố định (OpenAI)", () => {
  it("dùng đúng giọng đã định cho từng vai, không phụ thuộc giới tính", () => {
    const v = roleVoices({ A: "方强", B: "林雨" }, [], {}, { 方强: "echo", 林雨: "nova" });
    expect(v).toEqual({ A: "echo", B: "nova" });
  });
  it("vai thiếu trong bảng thì tự chọn, vai có trong bảng giữ nguyên", () => {
    const v = roleVoices({ A: "同学", B: "林雨" }, ["zf_xiaobei", "zm_yunxi"], { 同学: "m" }, { 林雨: "nova" });
    expect(v.B).toBe("nova");
    expect(v.A).toBeTruthy();
  });
});

describe("roleVoices", () => {
  it("vai nam dùng giọng nam, vai nữ dùng giọng nữ", () => {
    const v = roleVoices({ A: "刘明", B: "王一雪" }, ["zf_xiaobei", "zm_yunxi"], { 刘明: "m", 王一雪: "f" });
    expect(v).toEqual({ A: "zm_yunxi", B: "zf_xiaobei" });
  });
});

describe("fillRoleplayAudio", () => {
  const cfg = { rubric: "x", roleplay: { roles: { A: "刘明", B: "王一雪" }, turns: [{ speaker: "A", text: "你好" }, { speaker: "B", text: "你好吗", audio: "/api/exam-assets/old.mp3" }, { speaker: "A", text: "很好" }] } };
  const opts = { voices: ["zf_xiaobei", "zm_yunxi"], genders: { 刘明: "m", 王一雪: "f" } as Record<string, "m" | "f"> };

  it("chỉ gắn lượt chưa có audio, giữ phần còn lại", async () => {
    const calls: string[] = [];
    const r = await fillRoleplayAudio(cfg, { ...opts, synthesize: async (t, v) => (calls.push(`${v}:${t}`), `/api/exam-assets/${calls.length}.mp3`) });
    expect(calls).toEqual(["zm_yunxi:你好", "zm_yunxi:很好"]);
    const turns = (r.config as typeof cfg).roleplay.turns as Array<{ audio?: string }>;
    expect(turns.map((t) => t.audio)).toEqual(["/api/exam-assets/1.mp3", "/api/exam-assets/old.mp3", "/api/exam-assets/2.mp3"]);
    expect(r.attached).toBe(2);
    expect((r.config as typeof cfg).rubric).toBe("x");
    expect(cfg.roleplay.turns[0]).not.toHaveProperty("audio"); // không sửa cấu hình cũ
  });

  it("--force đọc lại cả lượt đã có; lỗi một lượt không chặn lượt khác", async () => {
    let n = 0;
    const r = await fillRoleplayAudio(cfg, { ...opts, force: true, synthesize: async () => { if (++n === 2) throw new Error("boom"); return `/api/exam-assets/${n}.mp3`; } });
    expect(r.attached).toBe(2);
    expect(r.failed).toBe(1);
  });
});
