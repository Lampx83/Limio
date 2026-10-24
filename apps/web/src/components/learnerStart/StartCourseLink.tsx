"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { sendOnboardingEvent } from "./onboardingEvent";

/** Liên kết trên trang Bắt đầu có ghi lượt bấm — điều hướng vẫn là Link thường, sự kiện gửi song song. */
export default function StartCourseLink({
  href,
  target,
  courseId,
  className,
  children,
}: {
  href: string;
  target: "catalog_course" | "catalog_all";
  courseId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => sendOnboardingEvent(target, courseId)}>
      {children}
    </Link>
  );
}
