import { prisma } from "@feedbackme/db";
import type { OnboardingCodeKind } from "@feedbackme/shared-types";

/**
 * Ô "Nhập mã" trên trang Bắt đầu của học viên (docs/hoc-vien/trang-dau-hoc-vien-AC.md, AC2).
 *
 * Học viên thường chỉ được thầy cô đọc cho một dãy ký tự và không biết đó là mã gì, nên ô này tự nhận
 * ra loại mã. Mỗi loại mã 6 ký tự chỉ duy nhất TRONG bảng của nó (cùng bảng chữ, cùng độ dài) — không
 * có gì ngăn mã lớp trùng mã trò chơi — nên tra hết các bảng; khớp nhiều loại thì để học viên chọn,
 * không đoán hộ.
 */

/** Chữ in hoa, bỏ dấu cách/gạch — giống `/thi` và ô mã kích hoạt khoá. */
export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type JoinKind = Exclude<OnboardingCodeKind, "access_code" | "exam_assigned" | "none" | "ambiguous">;

export interface JoinMatch {
  kind: JoinKind;
  href: string;
  /** Tên để học viên nhận ra khi phải chọn, vd "Lớp K65-CS1 — Đại số cơ bản". */
  label: string;
  /** Phiên đã kết thúc / ca thi đã đóng / bảng đã khoá. */
  ended: boolean;
}

export type JoinResolution =
  | { result: "access_code" }
  | { result: "redirect"; kind: OnboardingCodeKind; href: string }
  | { result: "ended"; match: JoinMatch }
  | { result: "choose"; matches: JoinMatch[] }
  | { result: "not_found" };

/**
 * Quyết định từ độ dài + các bản khớp. Tách khỏi phần tra DB để test được mọi nhánh.
 *  - 12 ký tự: mã kích hoạt khoá (XXXX-XXXX-XXXX) — trình duyệt gọi tiếp /api/redeem-code.
 *  - 8 ký tự: mã thí sinh được giao — chỉ duy nhất trong một đề nên KHÔNG tra ở đây; trang /exam/<mã>
 *    vốn đã tra và báo lỗi đúng.
 *  - 6 ký tự: theo các bản khớp.
 */
export function decideJoin(code: string, matches: JoinMatch[]): JoinResolution {
  if (code.length === 12) return { result: "access_code" };
  if (code.length === 8) return { result: "redirect", kind: "exam_assigned", href: `/exam/${code}` };
  if (code.length !== 6 || matches.length === 0) return { result: "not_found" };
  if (matches.length > 1) return { result: "choose", matches };
  const only = matches[0]!;
  return only.ended ? { result: "ended", match: only } : { result: "redirect", kind: only.kind, href: only.href };
}

/** Loại mã để ghi sự kiện (không ghi chính mã). */
export function resolutionKind(r: JoinResolution): { kind: OnboardingCodeKind; ended: boolean } {
  switch (r.result) {
    case "access_code":
      return { kind: "access_code", ended: false };
    case "redirect":
      return { kind: r.kind, ended: false };
    case "ended":
      return { kind: r.match.kind, ended: true };
    case "choose":
      return { kind: "ambiguous", ended: false };
    case "not_found":
      return { kind: "none", ended: false };
  }
}

/** Tra một mã 6 ký tự trong mọi bảng mã học viên có thể nhận. Bản nháp/đã xoá coi như không tồn tại. */
export async function findJoinMatches(code: string, db = prisma): Promise<JoinMatch[]> {
  if (code.length !== 6) return [];
  const [section, examSession, exam, oral, game, live, slideCode, board, whiteboard] = await Promise.all([
    db.courseSection.findUnique({
      where: { inviteCode: code },
      select: { name: true, isDefault: true, course: { select: { title: true, status: true } } },
    }),
    db.examSession.findFirst({
      where: { openCode: code },
      select: { title: true, status: true, exam: { select: { title: true } } },
    }),
    db.exam.findUnique({ where: { openCode: code }, select: { title: true, status: true } }),
    db.examSession.findUnique({
      where: { oralJoinCode: code },
      select: { title: true, status: true, exam: { select: { title: true } } },
    }),
    db.gameSession.findUnique({ where: { code }, select: { title: true, status: true } }),
    db.liveSession.findUnique({ where: { joinCode: code }, select: { endedAt: true, deck: { select: { title: true } } } }),
    db.liveSlideCode.findUnique({
      where: { code },
      select: { session: { select: { endedAt: true, deck: { select: { title: true } } } } },
    }),
    db.interactiveBoard.findUnique({ where: { code }, select: { title: true, status: true, deletedAt: true } }),
    db.whiteboard.findUnique({ where: { code }, select: { title: true, status: true, deletedAt: true } }),
  ]);

  const out: JoinMatch[] = [];
  // Lớp mặc định không có link mời (route ghi danh cũng từ chối) — bỏ qua như không có.
  if (section && !section.isDefault && section.course.status !== "draft") {
    out.push({
      kind: "section",
      href: `/enroll/${code}`,
      label: `Lớp ${section.name} — ${section.course.title}`,
      ended: section.course.status !== "published",
    });
  }
  // Ca thi theo đợt trước, rồi đề thi kiểu cũ — cùng thứ tự `/exam/[code]` đang tra, nên trùng hai bảng
  // này thì /exam cũng mở ca thi; chỉ liệt kê một dòng "Ca thi".
  if (examSession && examSession.status !== "draft") {
    out.push({
      kind: "exam",
      href: `/exam/${code}`,
      label: `Ca thi: ${examSession.title ?? examSession.exam.title}`,
      ended: examSession.status === "closed" || examSession.status === "archived",
    });
  } else if (exam && exam.status !== "draft") {
    out.push({ kind: "exam", href: `/exam/${code}`, label: `Bài thi: ${exam.title}`, ended: exam.status === "archived" });
  }
  if (oral && oral.status !== "draft") {
    out.push({
      kind: "oral",
      href: `/oral/${code}`,
      label: `Vấn đáp: ${oral.title ?? oral.exam.title}`,
      ended: oral.status === "closed" || oral.status === "archived",
    });
  }
  if (game) {
    out.push({ kind: "gameshow", href: `/play/${code}`, label: `Trò chơi: ${game.title}`, ended: game.status === "ended" });
  }
  const liveSession = live ?? slideCode?.session ?? null;
  if (liveSession) {
    out.push({
      kind: "live",
      href: `/learn/live/${code}`,
      label: `Bài giảng trực tiếp: ${liveSession.deck.title}`,
      ended: liveSession.endedAt !== null,
    });
  }
  if (board && !board.deletedAt) {
    out.push({ kind: "board", href: `/join/${code}`, label: `Bảng ý tưởng: ${board.title}`, ended: board.status === "closed" });
  }
  if (whiteboard && !whiteboard.deletedAt) {
    out.push({
      kind: "whiteboard",
      href: `/whiteboard/${code}`,
      label: `Bảng trắng: ${whiteboard.title}`,
      ended: whiteboard.status === "closed",
    });
  }
  return out;
}

export async function resolveJoinCode(raw: string, db = prisma): Promise<{ code: string; resolution: JoinResolution }> {
  const code = normalizeJoinCode(raw);
  const matches = await findJoinMatches(code, db);
  return { code, resolution: decideJoin(code, matches) };
}
