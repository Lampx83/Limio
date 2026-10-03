import {
  LANGUAGE_SKILL_LABEL,
  MASTERY_LABEL_TEXT,
  type LanguageSkill,
  type MasteryLabel,
} from "@feedbackme/shared-types";

/**
 * LANG G3 — hình học của radar 4 trục trong khung 220×220.
 *
 * Radar phản ánh NHÃN, không phản ánh giá trị mastery: mỗi nhãn ứng với một vòng
 * cố định. Nhờ vậy học viên không đọc được số từ vị trí điểm, đúng quyết định
 * "học viên chỉ thấy nhãn" của lộ trình cá nhân hoá (B4).
 */

export const RADAR_CENTER = 110;
export const RADAR_RADIUS = 80;

/** Bán kính (theo tỉ lệ) của từng nhãn. "Chưa đủ dữ liệu" nằm sát tâm, vẽ rỗng. */
const LEVEL: Record<MasteryLabel, number> = {
  no_data: 0.12,
  needs_review: 1 / 3,
  practice_more: 2 / 3,
  solid: 1,
};

// Nghe (trên), Nói (phải), Đọc (dưới), Viết (trái) — theo thứ tự LANGUAGE_SKILLS.
const ANGLE_DEG = [-90, 0, 90, 180] as const;

export interface RadarPoint {
  x: number;
  y: number;
  /** true = chưa đủ dữ liệu: vẽ chấm rỗng viền đứt. */
  hollow: boolean;
}

export function radarPoint(axisIndex: number, label: MasteryLabel, radius = RADAR_RADIUS): RadarPoint {
  const rad = (ANGLE_DEG[axisIndex]! * Math.PI) / 180;
  const r = radius * LEVEL[label];
  return {
    x: RADAR_CENTER + r * Math.cos(rad),
    y: RADAR_CENTER + r * Math.sin(rad),
    hollow: label === "no_data",
  };
}

/** Điểm trên một vòng đồng tâm (để vẽ lưới), `fraction` ∈ {1/3, 2/3, 1}. */
export function ringPoint(axisIndex: number, fraction: number): { x: number; y: number } {
  const rad = (ANGLE_DEG[axisIndex]! * Math.PI) / 180;
  return {
    x: RADAR_CENTER + RADAR_RADIUS * fraction * Math.cos(rad),
    y: RADAR_CENTER + RADAR_RADIUS * fraction * Math.sin(rad),
  };
}

/** Như nhãn chung của lộ trình, riêng "chưa có dữ liệu" nói rõ hơn là *chưa đủ*. */
export function languageLabelText(label: MasteryLabel): string {
  return label === "no_data" ? "Chưa đủ dữ liệu" : MASTERY_LABEL_TEXT[label];
}

/** Văn bản thay thế cho trình đọc màn hình: đúng thứ tự trục, không có số. */
export function radarAltText(rows: ReadonlyArray<{ skill: LanguageSkill; label: MasteryLabel }>): string {
  return rows.map((r) => `${LANGUAGE_SKILL_LABEL[r.skill]}: ${languageLabelText(r.label)}.`).join(" ");
}
