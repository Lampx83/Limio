"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Nút "Đấu trường" trên thanh đầu trang. Ẩn khi học viên đang thi: đường dẫn
 * vào thi (mã chung, mã cá nhân, lượt làm, phòng chờ) và các trang làm bài
 * trong khoá học. Ẩn ở đây để không lẫn màn hình thi với lối ra ngoài.
 */
const EXAM_PATHS = [
  /^\/exam(\/|$)/, // vào thi bằng mã: landing, phòng chờ, xác nhận, kết quả
  /^\/exam-take(\/|$)/, // làm bài
  /^\/learn\/[^/]+\/exams\/[^/]+\/(?!practice(\/|$))[^/]+/, // làm bài trong khoá học (theo lượt)
];

export function isExamPath(pathname: string): boolean {
  return EXAM_PATHS.some((re) => re.test(pathname));
}

export default function TournamentCta({ activeRole }: { activeRole: string }) {
  const pathname = usePathname() ?? "";
  if (isExamPath(pathname)) return null;
  return (
    <Link
      href={activeRole === "instructor" ? "/instructor/tournaments" : "/tournaments"}
      className="relative hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-amber-300/50 transition-all hover:from-amber-500 hover:to-orange-600 hover:shadow-md hover:shadow-amber-300/60 hover:-translate-y-px dark:shadow-amber-900/40"
    >
      {/* Live pulse dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      🏆 Đấu trường
    </Link>
  );
}
