import { describe, expect, it } from "vitest";
import {
  configText,
  detectLanguage,
  localizeCont,
  explicitLanguage,
  inferDeckLanguage,
  sanitizeDeckLanguage,
  slideText,
  topicLanguage,
} from "./limioLiveLanguage";
import { splitSlideConfig } from "./limioLiveSlides";
import { inferParts, referencesOutlineSlide } from "./limioLiveOutline";
import { formatCite } from "./limioLiveFigures";
import { sourceLine } from "./limioLiveCharts";
import { importLanguageText, type ImportedSlide } from "./limioLivePptx";

/** Slide viết theo ngôn ngữ của bài giảng — docs/tieu-chi/ngon-ngu-slide.md (L2, L2b, L3, L4, L11, L14). */

const VI = "Phản hồi là thông tin về khoảng cách giữa kết quả hiện tại và mục tiêu học tập của người học trong lớp.";
const EN = "Feedback is information about the gap between the current performance and the learning goal of the student.";

describe("detectLanguage (L2)", () => {
  it("tiếng Việt và tiếng Anh", () => {
    expect(detectLanguage(VI)).toBe("vi");
    expect(detectLanguage(EN)).toBe("en");
  });
  it("tiếng Việt có lẫn thuật ngữ tiếng Anh vẫn là tiếng Việt", () => {
    expect(detectLanguage("Bài giới thiệu về augmented reality (AR) và virtual reality trong lớp học cho sinh viên năm cuối.")).toBe("vi");
  });
  it("tiếng Anh có vài chữ có dấu (tên riêng) vẫn là tiếng Anh", () => {
    expect(detectLanguage(`${EN} This module was designed by Nguyễn Văn An for Hà Nội teachers.`)).toBe("en");
  });
  it("chữ Hán, Nhật, Hàn", () => {
    expect(detectLanguage("反馈是关于当前表现与学习目标之间差距的信息。")).toBe("zh");
    expect(detectLanguage("フィードバックは現在の成果と学習目標の差についての情報です。")).toBe("ja");
    expect(detectLanguage("피드백은 현재 수행과 학습 목표 사이의 차이에 대한 정보입니다.")).toBe("ko");
  });
  it("quá ngắn hoặc không chắc thì trả null", () => {
    expect(detectLanguage("")).toBeNull();
    expect(detectLanguage("AR và VR")).toBeNull();
    expect(detectLanguage("Ok 123 456 789 https://example.com/abc")).toBeNull();
    // Ngôn ngữ Latin khác (không phải Việt, không đủ dấu hiệu tiếng Anh): không đoán bừa.
    expect(detectLanguage("La rétroaction est une information sur l'écart entre la performance actuelle et l'objectif.")).toBeNull();
  });
  it("không tính đường link và con số", () => {
    expect(detectLanguage(`${VI} https://www.example.com/the-and-of-to-in 2024 2025`)).toBe("vi");
  });
});

describe("explicitLanguage (L2b)", () => {
  it("nhận ngôn ngữ ghi rõ trong mô tả tiếng Việt", () => {
    expect(explicitLanguage("Bài giảng bằng tiếng Anh về phản hồi cho sinh viên năm hai.")).toBe("en");
    expect(explicitLanguage("Bài về AR cho sinh viên, dạy bằng tiếng Anh.")).toBe("en");
    expect(explicitLanguage("Soạn slide tiếng Anh về chu trình nước.")).toBe("en");
    expect(explicitLanguage("Bài ôn tập, viết bằng tiếng Trung giản thể.")).toBe("zh");
    expect(explicitLanguage("Bài giảng bằng tiếng Việt cho lớp quốc tế.")).toBe("vi");
  });
  it("nhận ngôn ngữ ghi rõ bằng tiếng Anh", () => {
    expect(explicitLanguage("A lecture on photosynthesis in English for grade 10.")).toBe("en");
    expect(explicitLanguage("Bài về quang hợp, slides in English.")).toBe("en");
    expect(explicitLanguage("A lecture on Vietnamese history taught in Vietnamese.")).toBe("vi");
  });
  it("chỉ nhắc tên môn học thì không tính", () => {
    expect(explicitLanguage("Bài ôn tập ngữ pháp tiếng Anh cho học sinh lớp 9.")).toBeNull();
    expect(explicitLanguage("Bài về lịch sử tiếng Việt cho sinh viên ngữ văn.")).toBeNull();
  });
  it("topicLanguage: ghi rõ thắng chữ của mô tả", () => {
    expect(topicLanguage("Bài giảng bằng tiếng Anh về phản hồi trong dạy học cho sinh viên sư phạm năm hai.")).toBe("en");
    expect(topicLanguage(VI)).toBe("vi");
    expect(topicLanguage(EN)).toBe("en");
  });
});

describe("sanitizeDeckLanguage", () => {
  it("chỉ nhận mã trong danh sách", () => {
    expect(sanitizeDeckLanguage("en")).toBe("en");
    expect(sanitizeDeckLanguage("EN")).toBeNull();
    expect(sanitizeDeckLanguage("xx")).toBeNull();
    expect(sanitizeDeckLanguage(null)).toBeNull();
    expect(sanitizeDeckLanguage(3)).toBeNull();
  });
});

describe("bài cũ: nhận ngôn ngữ từ nội dung (L4)", () => {
  it("lấy chữ của slide, bỏ ghi chú giảng, link và trường kỹ thuật", () => {
    const t = configText({
      layout: "cards",
      title: "What is feedback",
      items: [{ heading: "Gap", body: "Feedback shows the gap.", icon: "target" }],
      notes: "Nhấn mạnh khoảng cách giữa hiện tại và mục tiêu.",
      imageUrl: "/api/limio-live-resource/a.png",
      motif: "dots",
    });
    expect(t).toContain("What is feedback");
    expect(t).toContain("Feedback shows the gap.");
    expect(t).not.toContain("Nhấn mạnh");
    expect(t).not.toContain("target");
    expect(t).not.toContain("/api/");
  });
  it("ưu tiên slide, rồi dàn ý, rồi tài liệu", () => {
    const enSlides = [{ title: EN }, { bullets: [EN] }];
    expect(inferDeckLanguage({ slides: enSlides, outlineText: VI, sourceText: VI })).toBe("en");
    expect(inferDeckLanguage({ slides: [], outlineText: EN, sourceText: VI })).toBe("en");
    expect(inferDeckLanguage({ slides: [{ title: "AR" }], outlineText: "", sourceText: VI })).toBe("vi");
    expect(inferDeckLanguage({ slides: [], outlineText: "", sourceText: "" })).toBeNull();
  });
});

describe("chữ hệ thống trên slide (L11)", () => {
  it("tiếng Việt và chưa xác định dùng bảng tiếng Việt", () => {
    for (const l of ["vi", null, undefined] as const) {
      const t = slideText(l);
      expect(t.cont).toBe(" (tiếp)");
      expect(t.references).toBe("Nguồn tham khảo");
      expect(t.part(2)).toBe("Phần 2");
      expect(t.series(1)).toBe("Chuỗi 1");
    }
  });
  it("tiếng Anh và ngôn ngữ khác dùng bảng tiếng Anh", () => {
    for (const l of ["en", "zh", "fr"] as const) {
      const t = slideText(l);
      expect(t.cont).toBe(" (cont.)");
      expect(t.mainContent).toBe("Main content");
      expect(t.part(3)).toBe("Part 3");
      expect(t.newPart).toBe("New section");
      expect(t.references).toBe("References");
      expect(t.source).toBe("Source");
      expect(t.imageSource).toBe("Image source");
      expect(t.unit).toBe("Unit");
      expect(t.series(2)).toBe("Series 2");
      expect(t.data).toBe("Data");
    }
  });
  it("nhận ra đuôi slide tiếp của cả hai bảng (không thêm lần nữa)", () => {
    expect(slideText("vi").isCont("Mục tiêu (tiếp)")).toBe(true);
    expect(slideText("en").isCont("Goals (cont.)")).toBe(true);
    expect(slideText("en").isCont("Goals")).toBe(false);
  });
});

describe("bộ dựng slide và dàn ý theo ngôn ngữ của bài (L3, L11)", () => {
  it("slide tách ra mang đuôi theo ngôn ngữ", () => {
    const cfg = { layout: "cards", title: "Goals", items: [1, 2, 3, 4].map((n) => ({ heading: `Goal ${n}`, body: "A full sentence." })) };
    expect(splitSlideConfig(cfg, "en")![1].title).toBe("Goals (cont.)");
    expect(splitSlideConfig(cfg)![1].title).toBe("Goals (tiếp)");
    expect(splitSlideConfig({ ...cfg, title: "Goals (cont.)" }, "en")![1].title).toBe("Goals (cont.)");
  });
  it("localizeCont đổi đuôi tiếng Việt sang ngôn ngữ của bài", () => {
    expect(localizeCont("Goals (tiếp)", "en")).toBe("Goals (cont.)");
    expect(localizeCont("Mục tiêu (tiếp)", "vi")).toBe("Mục tiêu (tiếp)");
    expect(localizeCont("Goals", "en")).toBe("Goals");
  });
  it("tên phần tự đặt và slide Nguồn tham khảo", () => {
    const slides = [{ id: "a", kind: "content" as const, layout: "image" as const, title: "What is AR", points: [] }];
    expect(inferParts({ title: "AR", slides }, "en").parts[0]!.name).toBe("Main content");
    expect(inferParts({ title: "AR", slides }).parts[0]!.name).toBe("Nội dung chính");
    expect(referencesOutlineSlide([{ n: 1, title: "AR basics", url: "https://example.com" }], "en").title).toBe("References");
  });
  it("dòng nguồn ở chân slide và dòng nguồn của bảng, biểu đồ", () => {
    expect(formatCite([2, 1], 3, slideText("en").source)).toBe("Source: [1], [2]");
    expect(formatCite([1], 3)).toBe("Nguồn: [1]");
    expect(sourceLine("UNESCO 2023", "Source")).toBe("Source: UNESCO 2023");
    expect(sourceLine("Source: UNESCO", "Source")).toBe("Source: UNESCO");
  });
  it("chữ của slide PowerPoint gốc để nhận ngôn ngữ, không tính ghi chú giảng", () => {
    const s = {
      n: 1, hidden: false, layoutType: "obj", title: "Feedback in the classroom", kicker: "", credit: "", caption: "",
      subtitle: [], paragraphs: [{ text: "Feedback is information about the gap between the current performance and the goal.", level: 0, numbered: false }],
      notes: "Nhấn mạnh khoảng cách giữa hiện tại và mục tiêu của người học trong lớp học hôm nay.", imageUrl: null, imageCount: 0, tables: [],
      charts: [], smartArt: [], emphasis: [],
    } as unknown as ImportedSlide;
    const text = importLanguageText({ slides: [s] });
    expect(text).not.toContain("Nhấn mạnh");
    expect(detectLanguage(text)).toBe("en");
  });
});
