"use client";

import Link from "next/link";
import { checkQuizLeave } from "@/lib/quizLeaveGuard";

/**
 * "← Quay lại khóa học" của trang làm quiz. Nếu người học đã chọn đáp án mà
 * chưa nộp thì hỏi lại trước khi đi, vì rời đi lúc đó là mất các câu đã chọn.
 */
export default function QuizBackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        const msg = checkQuizLeave();
        if (msg && !window.confirm(msg)) e.preventDefault();
      }}
      className="link inline-flex items-center gap-1 text-sm"
    >
      ← Quay lại khóa học
    </Link>
  );
}
