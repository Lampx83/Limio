/**
 * Giới hạn mạng khi VÀO THI, cấu hình theo từng trường (Organization.examAllowedIps).
 *
 * Phạm vi hẹp có chủ ý: chỉ bước vào thi các đề thuộc trường đó. Học liệu, diễn
 * đàn, bảng điểm... không đi qua đây nên không bị chặn khi học viên ở ngoài mạng
 * trường. Danh sách rỗng = không giới hạn, giữ nguyên hành vi cũ.
 *
 * File này thuần logic (không đọc header) — IP do tầng web đưa vào, vì chỉ web
 * biết proxy nào đáng tin. Xem apps/web/src/lib/exam-network.ts.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";

type Parsed = { family: 4 | 6; value: bigint };

function parseIpv4(s: string): bigint | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  let v = 0n;
  for (let i = 1; i <= 4; i++) {
    const n = Number(m[i]);
    if (n > 255) return null;
    v = (v << 8n) | BigInt(n);
  }
  return v;
}

function parseIpv6(s: string): bigint | null {
  let str = s;
  // Đuôi IPv4 nhúng (::ffff:1.2.3.4) → đổi sang hai nhóm hex.
  const tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(str);
  if (tail) {
    const v4 = parseIpv4(tail[1]!);
    if (v4 === null) return null;
    str =
      str.slice(0, -tail[1]!.length) +
      ((v4 >> 16n) & 0xffffn).toString(16) +
      ":" +
      (v4 & 0xffffn).toString(16);
  }
  const halves = str.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  let v = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    v = (v << 16n) | BigInt(parseInt(g, 16));
  }
  return v;
}

/** Chuẩn hoá chuỗi IP về (họ địa chỉ, giá trị). IPv4-mapped IPv6 đổi về IPv4. */
function parseIp(raw: string): Parsed | null {
  let s = raw.trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  s = s.replace(/%.+$/, ""); // bỏ zone id của IPv6 link-local
  if (!s) return null;
  if (s.includes(":")) {
    const v = parseIpv6(s);
    if (v === null) return null;
    // ::ffff:a.b.c.d
    if (v >> 32n === 0xffffn) return { family: 4, value: v & 0xffffffffn };
    return { family: 6, value: v };
  }
  const v4 = parseIpv4(s);
  return v4 === null ? null : { family: 4, value: v4 };
}

type Rule = { family: 4 | 6; base: bigint; prefix: number };

function parseRule(raw: string): Rule | null {
  const s = raw.trim();
  const slash = s.indexOf("/");
  const addr = slash === -1 ? s : s.slice(0, slash);
  const ip = parseIp(addr);
  if (!ip) return null;
  const bits = ip.family === 4 ? 32 : 128;
  let prefix = bits;
  if (slash !== -1) {
    const p = s.slice(slash + 1);
    if (!/^\d{1,3}$/.test(p)) return null;
    prefix = Number(p);
    if (prefix > bits) return null;
  }
  // Chuẩn hoá về địa chỉ mạng, để "10.0.0.5/24" cũng khớp cả dải.
  const shift = BigInt(bits - prefix);
  return { family: ip.family, base: (ip.value >> shift) << shift, prefix };
}

/**
 * Tách danh sách do người dùng nhập (mỗi dòng một IP/CIDR) thành quy tắc hợp lệ
 * và dòng lỗi. Bỏ dòng trống và phần chú thích sau `#`. Giữ thứ tự, bỏ trùng.
 */
export function parseIpRules(lines: string[]): { rules: string[]; invalid: string[] } {
  const rules: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const s = line.replace(/#.*$/, "").trim();
    if (!s) continue;
    if (parseRule(s) === null) {
      invalid.push(s);
      continue;
    }
    if (seen.has(s)) continue;
    seen.add(s);
    rules.push(s);
  }
  return { rules, invalid };
}

export type NetworkCheck =
  | { allowed: true }
  | { allowed: false; reason: "ip_unknown" | "ip_not_allowed"; ip: string | null };

/**
 * IP có nằm trong dải được phép không. `rules` rỗng → luôn cho vào. Có quy tắc mà
 * không xác định được IP (hoặc IP không đọc được) → từ chối: đóng cửa khi không
 * chắc, vì mở cửa im lặng là đúng thứ cấu hình này sinh ra để ngăn.
 */
export function evaluateNetwork(
  ip: string | null | undefined,
  rules: string[],
): NetworkCheck {
  if (rules.length === 0) return { allowed: true };
  const parsed = ip ? parseIp(ip) : null;
  if (!parsed) return { allowed: false, reason: "ip_unknown", ip: ip ?? null };
  for (const raw of rules) {
    const r = parseRule(raw);
    if (!r || r.family !== parsed.family) continue;
    const bits = parsed.family === 4 ? 32 : 128;
    const shift = BigInt(bits - r.prefix);
    if (parsed.value >> shift === r.base >> shift) return { allowed: true };
  }
  return { allowed: false, reason: "ip_not_allowed", ip: ip ?? null };
}

/**
 * Quy tắc mạng của trường sở hữu đề; rỗng khi đề/khoá không thuộc trường nào.
 * Đề luyện thi (mockMode) là chế độ học, không phải thi thật — không giới hạn.
 */
export async function examNetworkRulesForExam(
  examId: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const e = await db.exam.findUnique({
    where: { id: examId },
    select: {
      mockMode: true,
      course: { select: { organization: { select: { examAllowedIps: true } } } },
    },
  });
  if (!e || e.mockMode) return [];
  return e.course?.organization?.examAllowedIps ?? [];
}

export async function examNetworkRulesForOrg(
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const o = await db.organization.findUnique({
    where: { id: organizationId },
    select: { examAllowedIps: true },
  });
  return o?.examAllowedIps ?? [];
}
