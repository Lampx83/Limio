/**
 * Hội thoại đóng vai trong Bài luyện (docs/tieu-chi/limio-language-luyen-hoi-thoai-dong-vai.md): phần thuần của giao diện — đọc cấu hình
 * an toàn từ dữ liệu máy chủ, so lời học viên nói với câu mẫu (không điểm), dựng bản chữ để lưu và để AI nhận xét.
 */

export type RoleId = "A" | "B";

export interface RoleTurn {
  speaker: RoleId;
  text: string;
  /** Đường dẫn kho đề `/api/exam-assets/<tên>` của audio mẫu cho lượt này (không có thì lượt đó không có nút nghe). */
  audio?: string;
}

export interface RolePlayConfig {
  roles: Record<RoleId, string>;
  turns: RoleTurn[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const AUDIO_RE = /^\/api\/exam-assets\/[A-Za-z0-9._-]+$/;

/** Đọc `config.roleplay` từ dữ liệu không đáng tin; null nếu không phải hội thoại hợp lệ (ít hơn 2 lượt). Lượt sai dạng bị bỏ. */
export function parseRolePlay(config: unknown): RolePlayConfig | null {
  const rp = isObj(config) ? config.roleplay : null;
  if (!isObj(rp) || !Array.isArray(rp.turns)) return null;
  const turns: RoleTurn[] = [];
  for (const t of rp.turns) {
    if (!isObj(t)) continue;
    const speaker = t.speaker === "A" || t.speaker === "B" ? t.speaker : null;
    const text = typeof t.text === "string" ? t.text.trim() : "";
    if (!speaker || !text) continue;
    const audio = typeof t.audio === "string" && AUDIO_RE.test(t.audio) ? t.audio : undefined;
    turns.push({ speaker, text, ...(audio ? { audio } : {}) });
  }
  if (turns.length < 2) return null;
  const roles = isObj(rp.roles) ? rp.roles : {};
  const name = (k: RoleId) => (typeof roles[k] === "string" && (roles[k] as string).trim() ? (roles[k] as string).trim() : k);
  return { roles: { A: name("A"), B: name("B") }, turns };
}

/** Vai còn lại. */
export const otherRole = (r: RoleId): RoleId => (r === "A" ? "B" : "A");

// ── So lời nói với câu mẫu ──────────────────────────────────────────────────

/** Chuẩn hoá một từ để so: chữ thường, bỏ dấu tiếng Việt/Latinh, bỏ dấu câu và dấu nháy ('’). */
export function wordKey(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u00c0-\u1ef9]+/g, "");
}

export interface CompareWord {
  text: string;
  ok: boolean;
}

export interface SpokenComparison {
  words: CompareWord[];
  okCount: number;
  total: number;
  /** Từ máy nghe được nhưng không có trong câu mẫu (thừa hoặc nói khác). */
  extra: string[];
}

/**
 * So từng từ của câu mẫu với lời máy nghe được (dãy con chung dài nhất, nên nói thêm hay thiếu từ không làm lệch cả câu). Không phán đúng/sai
 * cả câu và không có điểm: chỉ đánh dấu từ nào nghe được và từ nào thiếu.
 */
export function compareSpoken(expected: string, spoken: string): SpokenComparison {
  const exp = expected.split(/\s+/).filter(Boolean);
  const heard = spoken.split(/\s+/).filter(Boolean);
  const ek = exp.map(wordKey);
  const hk = heard.map(wordKey);
  const n = exp.length;
  const m = hk.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = ek[i] && ek[i] === hk[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ok = new Array<boolean>(n).fill(false);
  const used = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ek[i] && ek[i] === hk[j] && dp[i]![j] === dp[i + 1]![j + 1]! + 1) {
      ok[i] = true;
      used[j] = true;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  return {
    words: exp.map((text, k) => ({ text, ok: ok[k]! })),
    okCount: ok.filter(Boolean).length,
    total: exp.filter((_, k) => ek[k] !== "").length,
    extra: heard.filter((w, k) => !used[k] && hk[k] !== ""),
  };
}

// ── Bản chữ để lưu và để AI nhận xét ─────────────────────────────────────────

/** Bản chữ câu trả lời: các lượt của học viên (đã nói) theo thứ tự, mỗi dòng "<số lượt>. A: …", đầu bài ghi vai. Rỗng nếu chưa nói lượt nào. */
export function answerTextOf(role: RoleId, rp: RolePlayConfig, spoken: Record<number, string>): string {
  const lines = rp.turns.flatMap((t, i) => (t.speaker === role && spoken[i] ? [`${i + 1}. ${role}: ${spoken[i]}`] : []));
  return lines.length ? `[Role ${role}]\n${lines.join("\n")}` : "";
}

/**
 * Đọc lại bản chữ đã lưu (`answerTextOf`) thành vai và lời nói từng lượt (theo số lượt ghi ở đầu dòng), để tải lại trang không mất phần đã nói.
 * Không đọc được (sai dạng, số lượt không thuộc vai đó) thì trả null.
 */
export function restoreSpoken(text: string, rp: RolePlayConfig): { role: RoleId; spoken: Record<number, string> } | null {
  const m = /^\[Role ([AB])\]\s*\n([\s\S]*)$/.exec(text.trim());
  if (!m) return null;
  const role = m[1] as RoleId;
  const spoken: Record<number, string> = {};
  for (const line of m[2]!.split(/\r?\n/)) {
    const lm = /^(\d+)\. ([AB]): (.+)$/.exec(line.trim());
    if (!lm || lm[2] !== role) continue;
    const i = Number(lm[1]) - 1;
    if (rp.turns[i]?.speaker === role) spoken[i] = lm[3]!.trim();
  }
  return Object.keys(spoken).length ? { role, spoken } : null;
}

/** Toàn bộ hội thoại theo kịch bản (mỗi dòng "A: …"), dùng làm bài mẫu cho AI khi giảng viên không viết bài mẫu riêng. */
export function scriptTextOf(rp: Pick<RolePlayConfig, "turns">): string {
  return rp.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
}

/** Soạn bằng chữ: mỗi dòng "A: câu" hoặc "B: câu" (không phân biệt hoa thường, cho phép bỏ khoảng trắng sau dấu hai chấm). Dòng không hợp lệ bị bỏ và báo số dòng. */
export function parseScript(text: string): { turns: Array<{ speaker: RoleId; text: string }>; badLines: number[] } {
  const turns: Array<{ speaker: RoleId; text: string }> = [];
  const badLines: number[] = [];
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const m = /^([AaBb])\s*[:：]\s*(.+)$/.exec(line);
    if (!m) {
      badLines.push(idx + 1);
      return;
    }
    turns.push({ speaker: m[1]!.toUpperCase() as RoleId, text: m[2]!.trim() });
  });
  return { turns, badLines };
}
