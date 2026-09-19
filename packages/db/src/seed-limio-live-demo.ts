/**
 * Seed bài giảng Limio-Live mẫu cho dev/local (idempotent: xoá & tạo lại các
 * deck có tiêu đề bắt đầu bằng "[Demo]" của tài khoản demo).
 * Chạy: pnpm --filter @feedbackme/db seed:limio-live-demo [email]
 */
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();
const EMAIL = process.argv[2] ?? "alice@feedbackme.dev";

const LONG_MD = Array.from({ length: 14 }, (_, i) => `## Mục ${i + 1}\n\nĐoạn văn dài để thử cuộn dọc: Design Thinking bị phê bình không ít, và sinh viên nên biết điều đó. Dùng nó như một bộ khung để tổ chức công việc thì tốt.\n\n- Ý chính ${i + 1}.1\n- Ý chính ${i + 1}.2`).join("\n\n");

type S = { type: string; config: Record<string, unknown>; timerSeconds?: number };

const DECKS: Array<{ title: string; theme: string; slides: S[] }> = [
  {
    title: "[Demo] Quang hợp — đủ loại slide",
    theme: "cream",
    slides: [
      { type: "content", timerSeconds: 300, config: { title: "Quang hợp", subtitle: "Bài 3", bullets: ["Ánh sáng", "CO₂ + nước", "Glucose + O₂"], presenterNote: "Mở bài: hỏi cả lớp cây lấy thức ăn ở đâu." } },
      { type: "quiz", timerSeconds: 60, config: { question: "Sản phẩm chính của quang hợp là gì?", options: [{ text: "Glucose", correct: true }, { text: "Protein" }, { text: "Muối khoáng" }, { text: "Nước" }], presenterNote: "Đáp án đúng: A." } },
      { type: "poll", config: { question: "Em rảnh thứ mấy để làm thí nghiệm?", options: [{ text: "Thứ 3" }, { text: "Thứ 5" }, { text: "Thứ 6" }] } },
      { type: "word_cloud", config: { prompt: "Nói 1 từ về quang hợp", presenterNote: "Gợi ý: ánh sáng, lá, xanh." } },
      { type: "collaborate_board", config: { prompt: "Ví dụ về quang hợp trong đời sống?", title: "Bảng ví dụ", mode: "free", allowViewOthers: true, blockPaste: false } },
      { type: "collaborate_board", config: { prompt: "Điều em hiểu / còn thắc mắc?", title: "Hiểu & thắc mắc", mode: "grouped", columns: ["Đã hiểu", "Còn thắc mắc", "Muốn tìm hiểu thêm"], allowViewOthers: true, blockPaste: true } },
    ],
  },
  {
    title: "[Demo] Học liệu dài — thử cuộn & mobile",
    theme: "mint",
    slides: [
      { type: "content", timerSeconds: 600, config: { resource: { type: "markdown", payload: { body: LONG_MD } }, presenterNote: "Slide học liệu dài: kiểm tra cuộn dọc + đồng hồ sticker." } },
      { type: "content", config: { title: "Tiêu đề rất dài để thử xuống dòng trên màn hình hẹp và trong chế độ zoom", subtitle: "Phụ đề", bullets: Array.from({ length: 8 }, (_, i) => `Ý số ${i + 1} khá dài để kiểm tra bố cục hai cột khi nội dung tràn khung`) } },
      { type: "quiz", config: { question: "Câu hỏi khá dài để thử ô nhập tự giãn: hãy cho biết đâu là bước đầu tiên trong quy trình Design Thinking và vì sao bước đó thường bị bỏ qua khi làm việc nhóm?", options: [{ text: "Đồng cảm", correct: true }, { text: "Định nghĩa vấn đề" }, { text: "Lên ý tưởng" }, { text: "Thử nghiệm" }, { text: "Đo lường" }] } },
    ],
  },
  {
    title: "[Demo] Bài giảng gọn 3 slide",
    theme: "brand",
    slides: [
      { type: "content", config: { title: "Xin chào lớp!", subtitle: "Buổi 1", bullets: [] } },
      { type: "poll", config: { question: "Hôm nay em thấy thế nào?", options: [{ text: "Tuyệt" }, { text: "Bình thường" }, { text: "Mệt" }] } },
      { type: "word_cloud", config: { prompt: "Mong đợi gì ở khoá học?" } },
    ],
  },
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`Không thấy user ${EMAIL}`);

  const removed = await prisma.liveDeck.deleteMany({ where: { userId: user.id, title: { startsWith: "[Demo]" } } });
  for (const d of DECKS) {
    await prisma.liveDeck.create({
      data: {
        userId: user.id,
        title: d.title,
        theme: d.theme,
        slides: {
          create: d.slides.map((s, i) => ({
            type: s.type as never,
            config: s.config as never,
            timerSeconds: s.timerSeconds ?? null,
            orderIndex: i,
          })),
        },
      },
    });
  }
  console.log(`Đã xoá ${removed.count} deck [Demo] cũ, tạo ${DECKS.length} deck mới cho ${EMAIL}`);
}

main().finally(() => prisma.$disconnect());
