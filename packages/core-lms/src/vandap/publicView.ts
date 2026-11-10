import { prisma, type PrismaClient } from "@feedbackme/db";

/**
 * Phần học viên ĐƯỢC thấy (AC1.11). Cố ý chỉ liệt kê từng trường được phép, KHÔNG bao giờ trả cả hàng của bảng:
 * `VanDapItem` (ý cần hỏi, đáp án mong đợi, đoạn nguồn) và `aiContext` của kịch bản không có trong kết quả này,
 * và test kiểm trực tiếp điều đó. Thêm trường vào đây là một quyết định về việc lộ gì cho học viên.
 */
export interface VanDapPublicView {
  examId: string;
  title: string;
  durationMin: number;
  language: string;
  scenarios: Array<{ id: string; title: string; studentBrief: string | null }>;
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Mã tham gia 6 ký tự của buổi (cùng bảng chữ với các loại mã khác; trùng loại khác thì ô "Nhập mã" cho chọn). */
export function generateVanDapJoinCode(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length];
  return s;
}

export async function getVanDapPublicView(examId: string, db: PrismaClient = prisma): Promise<VanDapPublicView | null> {
  const exam = await db.vanDapExam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      durationMin: true,
      language: true,
      status: true,
      scenarios: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, studentBrief: true } },
    },
  });
  if (!exam || exam.status !== "published") return null;
  return {
    examId: exam.id,
    title: exam.title,
    durationMin: exam.durationMin,
    language: exam.language,
    scenarios: exam.scenarios.map((s) => ({ id: s.id, title: s.title, studentBrief: s.studentBrief })),
  };
}

export interface VanDapJoinInfo {
  sessionId: string;
  isOpen: boolean;
  exam: VanDapPublicView;
}

/** Tra mã 6 ký tự của buổi Limio Vấn đáp. Không có buổi/đề chưa xuất bản → null. */
export async function resolveVanDapJoinCode(code: string, db: PrismaClient = prisma): Promise<VanDapJoinInfo | null> {
  const session = await db.vanDapSession.findUnique({
    where: { joinCode: code },
    select: { id: true, status: true, examId: true },
  });
  if (!session) return null;
  const exam = await getVanDapPublicView(session.examId, db);
  if (!exam) return null;
  return { sessionId: session.id, isOpen: session.status === "open", exam };
}
