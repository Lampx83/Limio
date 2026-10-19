import { WifiOff } from "lucide-react";
import EntryShell, { EntryGreeting } from "./EntryShell";

/**
 * Báo học viên đang ở ngoài dải mạng được phép vào thi (cấu hình theo trường).
 * Chỉ chặn bước vào thi; các phần khác của hệ thống vẫn dùng bình thường.
 *
 * Một câu duy nhất cho mọi lý do (ngoài dải, hoặc hệ thống không xác định được IP):
 * học viên chỉ cần biết "mạng này chưa vào thi được". Lý do chi tiết nằm ở trang
 * cài đặt của quản trị viên. Dùng cùng khung với phòng chờ để luồng vào thi liền mạch.
 */
export const NETWORK_BLOCKED_MESSAGE = "Bạn đang ở dải mạng không phù hợp để vào thi.";

export default function NetworkBlocked({
  displayName,
  examTitle,
  subtitle,
}: {
  displayName: string;
  /** Tiêu đề lớn: tên ca (hoặc tên đề khi ca chưa đặt tên). */
  examTitle?: string | null;
  subtitle?: string | null;
}) {
  return (
    <EntryShell step={2}>
      <EntryGreeting name={displayName} />
      <div className="mt-4 flex justify-center">
        <span
          className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          role="status"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          Chưa vào được phòng chờ
        </span>
      </div>
      {examTitle && (
        <div className="mt-5 text-center">
          <h1 className="text-h2 text-[rgb(var(--text))]">{examTitle}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      )}
      <div className="mt-7 flex justify-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-full border-[10px] border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <WifiOff className="h-14 w-14 text-amber-500" aria-hidden />
        </div>
      </div>
      <p
        role="alert"
        className="mt-7 text-center text-lg font-semibold leading-snug text-[rgb(var(--text))]"
      >
        {NETWORK_BLOCKED_MESSAGE}
      </p>
    </EntryShell>
  );
}
