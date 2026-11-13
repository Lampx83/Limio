"use client";

import type { MasteryLabel } from "@feedbackme/shared-types";
import { useT } from "@/lib/i18n/client";
import StatusBadge, { type StatusTone } from "@/components/ui/StatusBadge";

/**
 * B4 — nhãn mức nắm vững cho học viên. Học viên chỉ thấy nhãn, không thấy số %
 * (quyết định 2026-09-27); trang giáo viên vẫn hiện số.
 *
 * "Cần ôn" dùng vàng chứ không đỏ: đây là lời nhắc việc nên làm, không phải lỗi.
 */
const TONE: Record<MasteryLabel, StatusTone> = {
  no_data: "neutral",
  needs_review: "warning",
  practice_more: "info",
  solid: "success",
};

export default function MasteryBadge({
  label,
  className,
}: {
  label: MasteryLabel;
  className?: string;
}) {
  const t = useT();
  return (
    <StatusBadge tone={TONE[label]} className={className}>
      {t(`learn.mastery.${label}`)}
    </StatusBadge>
  );
}
