/**
 * Import hàng loạt thành viên vào một trường (OrgAdmin của trường đó hoặc
 * Platform Admin). Hai bước, giống import đề thi:
 *   1. previewOrgMemberImport — phân loại từng dòng, KHÔNG ghi gì.
 *   2. importOrgMembers       — thực thi; lỗi ở dòng nào chỉ hỏng dòng đó.
 *
 * Mail mời đặt mật khẩu cho tài khoản mới: theo cấu hình của trường
 * (`Organization.inviteEmailOnImport`, mặc định tắt, xem email-settings.ts) —
 * áp dụng như nhau cho Platform Admin lẫn OrgAdmin. Client không tự quyết được.
 *
 * Nguồn dữ liệu: file .xlsx/.csv (parseMemberImportSheet) hoặc văn bản dán
 * vào (parseMemberImportText). Chỉ cần cột email; tên hiển thị tuỳ chọn.
 * Mỗi dòng đi qua addOrgMember nên có audit log + event như thêm tay.
 */
import * as XLSX from "xlsx";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isOrgAdminOf } from "../auth/roles";
import { addOrgMember, OrgMemberError } from "./members";

/** Trần số dòng mỗi lần: mỗi dòng tạo user (+ có thể gửi mail) tuần tự trong 1 request. */
export const MEMBER_IMPORT_MAX_ROWS = 500;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MemberImportInputRow {
  email: string;
  displayName?: string;
}

export interface ParsedMemberRow extends MemberImportInputRow {
  /** Số dòng trong file gốc (1-based, tính cả header) để báo lỗi cho người dùng. */
  line: number;
}

export type MemberImportRowStatus =
  | "new" // chưa có tài khoản → sẽ tạo
  | "existing" // có tài khoản, chưa thuộc trường nào → sẽ gắn vào
  | "already_member" // đã thuộc trường này → bỏ qua
  | "other_org" // thuộc trường khác → bỏ qua
  | "invalid_email"
  | "duplicate"; // trùng email với dòng trước trong cùng file

export interface MemberImportPreviewRow extends ParsedMemberRow {
  status: MemberImportRowStatus;
}

export interface MemberImportPreview {
  rows: MemberImportPreviewRow[];
  counts: Record<MemberImportRowStatus, number>;
  /** Số dòng sẽ thực sự thay đổi dữ liệu (new + existing). */
  actionable: number;
  /** Cấu hình hiện tại của trường: import này có gửi mail mời cho tài khoản mới không. */
  willSendInvite: boolean;
}

const EMAIL_HEADERS = ["email", "e-mail", "mail", "địa chỉ email", "dia chi email"];
const NAME_HEADERS = [
  "displayname",
  "display name",
  "name",
  "họ tên",
  "họ và tên",
  "ho ten",
  "ho va ten",
  "tên hiển thị",
  "tên",
];

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Lấy các dòng từ mảng-của-mảng; tự nhận header nếu dòng đầu chứa cột email. */
function rowsFromMatrix(matrix: unknown[][]): ParsedMemberRow[] {
  let emailCol = 0;
  let nameCol = 1;
  let start = 0;

  const first = (matrix[0] ?? []).map(norm);
  const headerEmail = first.findIndex((c) => EMAIL_HEADERS.includes(c));
  if (headerEmail >= 0) {
    emailCol = headerEmail;
    const headerName = first.findIndex((c) => NAME_HEADERS.includes(c));
    nameCol = headerName >= 0 ? headerName : -1;
    start = 1;
  }

  const out: ParsedMemberRow[] = [];
  for (let i = start; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const email = String(r[emailCol] ?? "").trim();
    const displayName = nameCol >= 0 ? String(r[nameCol] ?? "").trim() : "";
    if (!email && !displayName) continue; // dòng trống
    out.push({ line: i + 1, email, displayName: displayName || undefined });
  }
  return out;
}

/** Đọc file .xlsx / .xls / .csv (sheet đầu tiên). */
export function parseMemberImportSheet(buf: Buffer): ParsedMemberRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  return rowsFromMatrix(matrix);
}

/** Văn bản dán vào: mỗi dòng "email" hoặc "email<phân cách>tên" (tab, `;` hoặc `,`). */
export function parseMemberImportText(text: string): ParsedMemberRow[] {
  const matrix = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .map((l) => (l ? l.split(/[\t;,]/).map((c) => c.trim()) : []));
  return rowsFromMatrix(matrix);
}

/** File mẫu để tải về. */
export function generateMemberImportTemplateXlsx(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ["email", "displayName"],
    ["hocvien1@truong.edu.vn", "Nguyễn Văn A"],
    ["hocvien2@truong.edu.vn", "Trần Thị B"],
  ]);
  ws["!cols"] = [{ wch: 32 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Members");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function assertOrgAdmin(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient,
): Promise<void> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new OrgMemberError("forbidden");
  }
}

export class MemberImportError extends Error {
  constructor(public readonly code: "too_many_rows" | "no_rows") {
    super(code);
  }
}

export async function previewOrgMemberImport(
  actorUserId: string,
  organizationId: string,
  rows: ParsedMemberRow[],
  db: PrismaClient = prisma,
): Promise<MemberImportPreview> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  if (rows.length === 0) throw new MemberImportError("no_rows");
  if (rows.length > MEMBER_IMPORT_MAX_ROWS) throw new MemberImportError("too_many_rows");

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { inviteEmailOnImport: true },
  });
  if (!org) throw new OrgMemberError("org_not_found");

  const emails = Array.from(
    new Set(rows.map((r) => r.email.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))),
  );
  const found = await db.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, organizationId: true },
  });
  const byEmail = new Map(found.map((u) => [u.email.toLowerCase(), u.organizationId]));

  const seen = new Set<string>();
  const counts: Record<MemberImportRowStatus, number> = {
    new: 0,
    existing: 0,
    already_member: 0,
    other_org: 0,
    invalid_email: 0,
    duplicate: 0,
  };
  const out: MemberImportPreviewRow[] = rows.map((r) => {
    const email = r.email.trim().toLowerCase();
    let status: MemberImportRowStatus;
    if (!EMAIL_RE.test(email)) status = "invalid_email";
    else if (seen.has(email)) status = "duplicate";
    else if (!byEmail.has(email)) status = "new";
    else {
      const org = byEmail.get(email);
      status = org === organizationId ? "already_member" : org ? "other_org" : "existing";
    }
    if (status !== "invalid_email") seen.add(email);
    counts[status]++;
    return { ...r, email, status };
  });

  return {
    rows: out,
    counts,
    actionable: counts.new + counts.existing,
    willSendInvite: org.inviteEmailOnImport,
  };
}

export type MemberImportOutcome = "created" | "attached" | "skipped" | "failed";

export interface MemberImportResultRow {
  line: number;
  email: string;
  outcome: MemberImportOutcome;
  /** Với skipped/failed: mã lý do (OrgMemberError code hoặc status của preview). */
  reason?: string;
  invited?: boolean;
}

export interface MemberImportResult {
  results: MemberImportResultRow[];
  created: number;
  attached: number;
  skipped: number;
  failed: number;
}

export async function importOrgMembers(
  actorUserId: string,
  organizationId: string,
  rows: ParsedMemberRow[],
  opts: { baseUrl: string },
  db: PrismaClient = prisma,
): Promise<MemberImportResult> {
  // Preview kiểm quyền + giới hạn, và lọc trước các dòng chắc chắn bỏ qua.
  const preview = await previewOrgMemberImport(actorUserId, organizationId, rows, db);

  const sendInvite = preview.willSendInvite;

  const results: MemberImportResultRow[] = [];
  const tally = { created: 0, attached: 0, skipped: 0, failed: 0 };

  for (const row of preview.rows) {
    if (row.status !== "new" && row.status !== "existing") {
      results.push({ line: row.line, email: row.email, outcome: "skipped", reason: row.status });
      tally.skipped++;
      continue;
    }
    try {
      const r = await addOrgMember(
        actorUserId,
        organizationId,
        {
          email: row.email,
          displayName: row.displayName,
          baseUrl: opts.baseUrl,
          sendInvite,
        },
        db,
      );
      if (r.created) {
        tally.created++;
        results.push({ line: row.line, email: row.email, outcome: "created", invited: r.invited });
      } else {
        tally.attached++;
        results.push({ line: row.line, email: row.email, outcome: "attached" });
      }
    } catch (e) {
      // Trạng thái đổi giữa preview và import (race): vẫn chỉ hỏng dòng này.
      const reason = e instanceof OrgMemberError ? e.code : "unexpected_error";
      if (!(e instanceof OrgMemberError)) console.error("[org-member-import] row failed", e);
      results.push({ line: row.line, email: row.email, outcome: "failed", reason });
      tally.failed++;
    }
  }

  return { results, ...tally };
}
