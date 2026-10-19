import { describe, expect, it } from "vitest";
import { contrastTones, groupHeadPx, groupsFit, isNegativeAsk, numberOf, numericPoints, type GroupsContent } from "./limioLiveGroups";

const g = (heading: string, ...points: string[]) => ({ heading, points });

describe("numberOf (P55, P59)", () => {
  it("lấy con số kèm % hoặc 'lần' nguyên văn từ ý con", () => {
    expect(numberOf("Positive thinkers have 23% lower levels of stress hormones")).toBe("23%");
    expect(numberOf("Problem-solving ability improves by up to 20% in positive mental states")).toBe("20%");
    expect(numberOf("Tăng 2,5 lần so với năm trước")).toBe("2,5 lần");
    expect(numberOf("Chỉ 17 % học sinh")).toBe("17%");
  });
  it("ý không có số kèm đơn vị thì không có con số", () => {
    expect(numberOf("Enhanced creativity and cognitive flexibility")).toBeNull();
    expect(numberOf("Trong 2025 có 3 mục tiêu")).toBeNull();
  });
  it("numericPoints đếm ý có số", () => {
    expect(numericPoints(["a 5%", "b", "c 10%"])).toBe(2);
  });
});

describe("isNegativeAsk (P55)", () => {
  it("câu dẫn phủ định thì dấu đầu dòng là ×", () => {
    expect(isNegativeAsk("What positive thinking is not?")).toBe(true);
    expect(isNegativeAsk("Điều này không phải là gì?")).toBe(true);
    expect(isNegativeAsk("Common myths")).toBe(true);
  });
  it("câu dẫn thường thì không", () => {
    expect(isNegativeAsk("Why positive thinking matter?")).toBe(false);
    expect(isNegativeAsk("Notable people")).toBe(false);
  });
});

describe("contrastTones (P56)", () => {
  it("hai nhóm đối lập: nhóm đi xuống màu ấm, nhóm đi lên màu chủ đạo", () => {
    expect(contrastTones("Năng lực đang mất lợi thế", "Năng lực đang gia tăng nhu cầu")).toEqual(["bad", "good"]);
    expect(contrastTones("Pros", "Cons")).toEqual(["good", "bad"]);
    expect(contrastTones("Trước đây", "Hiện nay")).toEqual(["bad", "good"]);
  });
  it("không đối lập thì null", () => {
    expect(contrastTones("AI Literacy", "Đạo đức số")).toBeNull();
    expect(contrastTones("Bản chất", "Đặc trưng")).toBeNull();
    expect(contrastTones("Mất mát", "Giảm sút")).toBeNull();
  });
});

describe("groupsFit: kiểu trình bày theo nội dung (P55, P57)", () => {
  const fit = (c: GroupsContent) => groupsFit(c);

  it("2 nhóm ngắn → Thẻ", () => {
    const r = fit({ title: "2.1. TECHNOLOGY IN EDUCATION", groups: [g("Bản chất", "Ứng dụng công nghệ như công cụ hỗ trợ giảng dạy"), g("Đặc trưng", "Tập trung vào phương tiện", "Không thay đổi bản chất phương pháp dạy học", "Giáo viên vẫn là trung tâm điều khiển")] });
    expect(r.variant).toBe("cards");
    expect(r.overflow).toBe(false);
    expect(r.px).toBeGreaterThanOrEqual(26);
  });

  it("một nhóm không có số → Câu dẫn và các dòng", () => {
    const r = fit({ title: "1. POSITIVE THINKING", groups: [g("What positive thinking is not?", "Ignoring problems or reality", "Toxic positivity (forced optimism)", 'Just "thinking happy thoughts"')] });
    expect(r.variant).toBe("ask");
    expect(r.overflow).toBe(false);
  });

  it("một nhóm có 2 ý có số → Số liệu", () => {
    const r = fit({
      title: "1. POSITIVE THINKING",
      lead: "Why positive thinking matter?",
      groups: [g("Research findings", "Positive thinkers have 23% lower levels of stress hormones", "Problem-solving ability improves by up to 20% in positive mental states", "Enhanced creativity and cognitive flexibility", "Better team collaboration and communication")],
    });
    expect(r.variant).toBe("stats");
    expect(r.overflow).toBe(false);
  });

  it("một nhóm chỉ có 1 ý có số thì không thành Số liệu", () => {
    expect(fit({ title: "t", groups: [g("Câu hỏi?", "Có 20% học sinh", "Không số")] }).variant).toBe("ask");
  });

  it("5 nhóm ý con vừa phải → Danh sách nhóm hai cột, chữ không dưới 26 px", () => {
    const r = fit({
      title: "4.1 Năm nhóm năng lực AI cần bổ sung vào chương trình ED2",
      groups: [
        g("AI Literacy", "Hiểu nguyên lý, khả năng và giới hạn của AI để dùng có trách nhiệm."),
        g("Đạo đức & Trách nhiệm số", "Nhận thức quyền riêng tư, bản quyền khi dùng AI trong giáo dục."),
        g("Sử dụng AI chuyên môn", "Khai thác AI hỗ trợ thiết kế học tập và phát triển học liệu."),
        g("Đánh giá & kiểm chứng AI", "Phát hiện sai lệch và đánh giá độ tin cậy của đầu ra AI."),
        g("Thiết kế đánh giá", "Đo lường đúng năng lực thực của người học khi AI phổ biến."),
      ],
    });
    expect(r.variant).toBe("list");
    expect(r.cols).toBe(2);
    expect(r.overflow).toBe(false);
    expect(r.px).toBeGreaterThanOrEqual(26);
  });

  it("2 nhóm có ý con dài không vừa thẻ → nhường cho Danh sách nhóm một cột", () => {
    const long = "Một câu dài mô tả đầy đủ năng lực cần đạt, có nhiều vế và nhiều ý nhỏ cần được trình bày cho trọn nghĩa.";
    const r = fit({ title: "Hai nhóm", groups: [g("Nhóm một", long, long), g("Nhóm hai", long, long)] });
    expect(r.variant).toBe("list");
    expect(r.cols).toBe(1);
  });

  it("quá nhiều chữ thì báo tràn để người gọi chia slide", () => {
    const long = "Một câu rất dài mô tả đầy đủ năng lực cần đạt, có nhiều vế và nhiều ý nhỏ cần được trình bày cho trọn nghĩa, kèm ví dụ cụ thể.";
    const groups = Array.from({ length: 6 }, (_, i) => g(`Nhóm số ${i + 1}`, long, long, long, long, long));
    expect(fit({ title: "Quá dài", groups }).overflow).toBe(true);
  });
});

describe("chữ thân không bao giờ bé khi còn chỗ (P55)", () => {
  it("slide ít chữ: ý con lấy cỡ lớn, ý cha cùng cỡ (phân cấp bằng màu, không bằng cỡ chữ)", () => {
    const cards = groupsFit({ title: "2.1. TECHNOLOGY IN EDUCATION", groups: [g("Bản chất", "Ứng dụng công nghệ như công cụ hỗ trợ giảng dạy"), g("Đặc trưng", "Tập trung vào phương tiện", "Không thay đổi bản chất phương pháp dạy học", "Giáo viên vẫn là trung tâm điều khiển")] });
    expect(cards.variant).toBe("cards");
    expect(cards.px).toBeGreaterThanOrEqual(32);
    expect(groupHeadPx(cards.px)).toBe(cards.px);
    const ask = groupsFit({ title: "t", groups: [g("What positive thinking is not?", "Ignoring problems or reality", "Toxic positivity (forced optimism)")] });
    expect(ask.variant).toBe("ask");
    expect(ask.px).toBeGreaterThanOrEqual(40);
  });
  it("nhiều chữ thì co dần nhưng không dưới 26 px", () => {
    const many = groupsFit({ title: "Năm nhóm", groups: Array.from({ length: 5 }, (_, i) => g(`Nhóm ${i + 1}`, "Một câu mô tả vừa phải về năng lực cần đạt của nhóm này trong chương trình học.")) });
    expect(many.px).toBeGreaterThanOrEqual(26);
    expect(many.px).toBeLessThan(40);
  });
});
