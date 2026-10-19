import type { LibraryFilters, MyStatus, PaperType } from "@feedbackme/core-lms";
import type { MasteryLabel } from "@feedbackme/shared-types";

/**
 * LANG L6.2 — bộ lọc thư viện đề ⇄ tham số URL. Trang học viên giữ bộ lọc trong URL (chia sẻ/refresh được);
 * giá trị lạ bị bỏ chứ không gây lỗi.
 */
const PAPER: PaperType[] = ["official", "mock", "practice_set"];
const STATUS: MyStatus[] = ["not_started", "in_progress", "done", "redo"];
const SORT = ["seq", "unstarted", "newest"] as const;
const Q_MAX = 100;

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseLibraryParams(sp: Params): LibraryFilters {
  const out: LibraryFilters = {};
  const c = first(sp.c)?.trim();
  if (c) out.collectionId = c;
  const t = first(sp.t);
  if (t && (PAPER as string[]).includes(t)) out.paperType = t as PaperType;
  const y = first(sp.y)?.trim();
  if (y) out.year = y.slice(0, 40);
  const d = Number(first(sp.d));
  if (Number.isInteger(d) && d >= 1 && d <= 5) out.difficulty = d;
  const s = first(sp.s);
  if (s && (STATUS as string[]).includes(s)) out.status = s as MyStatus;
  const q = first(sp.q)?.trim();
  if (q) out.q = q.slice(0, Q_MAX);
  const sort = first(sp.sort);
  if (sort && (SORT as readonly string[]).includes(sort)) out.sort = sort as (typeof SORT)[number];
  const cur = first(sp.cursor);
  if (cur && /^\d+$/.test(cur) && Number(cur) > 0) out.cursor = cur;
  return out;
}

export function libraryQueryString(f: LibraryFilters): string {
  const p = new URLSearchParams();
  if (f.collectionId) p.set("c", f.collectionId);
  if (f.paperType) p.set("t", f.paperType);
  if (f.year) p.set("y", f.year);
  if (f.difficulty) p.set("d", String(f.difficulty));
  if (f.status) p.set("s", f.status);
  if (f.q) p.set("q", f.q);
  if (f.sort) p.set("sort", f.sort);
  if (f.cursor) p.set("cursor", f.cursor);
  return p.toString();
}

const STATUS_TEXT: Record<MyStatus, string> = { not_started: "Chưa làm", in_progress: "Đang làm", done: "Đã làm", redo: "Nên làm lại" };
export const statusLabelText = (s: MyStatus) => STATUS_TEXT[s];

const LEVEL_TEXT: Partial<Record<MasteryLabel, string>> = { needs_review: "Cần ôn", practice_more: "Nên luyện", solid: "Vững" };
export const levelLabelText = (l: MasteryLabel | null): string => (l ? (LEVEL_TEXT[l] ?? "") : "");

export const PAPER_TYPE_TEXT: Record<PaperType, string> = { official: "Đề thật", mock: "Đề thi thử", practice_set: "Bộ luyện" };
