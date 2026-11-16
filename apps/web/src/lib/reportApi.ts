/** Tiện ích chung cho các route Báo cáo nhà xuất bản (docs/tieu-chi/bao-cao-nha-xuat-ban.md). */
import type { ReportRange, ReportViewerError } from "@feedbackme/core-lms";

export function parseReportRange(v: string | null | undefined): ReportRange {
  if (v === "30") return 30;
  if (v === "all") return "all";
  return 90;
}

export function reportViewerErrorStatus(code: ReportViewerError["code"]): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "org_not_found":
    case "user_not_found":
    case "not_viewer":
      return 404;
    case "already_viewer":
      return 409;
    default:
      return 400;
  }
}
