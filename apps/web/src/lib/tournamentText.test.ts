import { describe, expect, it } from "vitest";
import { tournamentErrorMessage, TOURNAMENT_TERMS } from "./tournamentText";

describe("tournamentErrorMessage", () => {
  it("dịch mã lỗi chính", () => {
    expect(tournamentErrorMessage({ error: "registration_closed" })).toMatch(/đã đóng/i);
    expect(tournamentErrorMessage({ error: "past_deadline" })).toMatch(/hạn nộp/i);
    expect(tournamentErrorMessage({ error: "tournament_not_open" })).toMatch(/chưa bắt đầu|đã kết thúc/i);
    expect(tournamentErrorMessage({ error: "forbidden" })).toMatch(/quyền/i);
    expect(tournamentErrorMessage({ error: "unauthorized" })).toMatch(/đăng nhập/i);
    expect(tournamentErrorMessage({ error: "team_join_code_invalid" })).toMatch(/mã đội/i);
    expect(tournamentErrorMessage({ error: "team_locked_after_start" })).toMatch(/không thể đổi/i);
  });

  it("validation_failed lấy nghĩa từ details dạng chuỗi", () => {
    expect(tournamentErrorMessage({ error: "validation_failed", details: "endsAt_before_startsAt" })).toMatch(
      /kết thúc.*sau.*bắt đầu/i,
    );
    expect(tournamentErrorMessage({ error: "validation_failed", details: "team_size_locked" })).toMatch(/số người mỗi đội/i);
    expect(tournamentErrorMessage({ error: "validation_failed", details: "no_missions" })).toMatch(/ít nhất 1 nhiệm vụ/i);
    expect(tournamentErrorMessage({ error: "validation_failed", details: "prize_distribution_missing" })).toMatch(
      /chia tỷ lệ/i,
    );
  });

  it("validation_failed với details dạng object (zod) ra câu chung, không lộ JSON", () => {
    const msg = tournamentErrorMessage({
      error: "validation_failed",
      details: { fieldErrors: { title: ["Required"] }, formErrors: [] },
    });
    expect(msg).not.toMatch(/fieldErrors|Required|\{/);
    expect(msg).toMatch(/chưa hợp lệ/i);
  });

  it("mã lạ không bao giờ hiện thô", () => {
    const msg = tournamentErrorMessage({ error: "some_new_code_xyz" });
    expect(msg).not.toMatch(/some_new_code_xyz/);
    expect(msg).toMatch(/thử lại/i);
  });

  it("dùng fallback riêng khi có", () => {
    expect(tournamentErrorMessage({}, "Không đăng ký được.")).toBe("Không đăng ký được.");
    expect(tournamentErrorMessage({ error: "zzz" }, "Không đăng ký được.")).toBe("Không đăng ký được.");
  });
});

describe("TOURNAMENT_TERMS", () => {
  it("thuật ngữ thống nhất bằng tiếng Việt", () => {
    expect(TOURNAMENT_TERMS.mission).toBe("Nhiệm vụ");
    expect(TOURNAMENT_TERMS.publish).toBe("Công bố");
    expect(TOURNAMENT_TERMS.captain).toBe("Đội trưởng");
  });
});
