import { redirect } from "next/navigation";

/**
 * Đường cũ — nay lịch sử và form nằm chung một trang theo từng hình thức.
 * Giữ redirect để link đã gửi đi không chết.
 */
export default function LegacyQuickPage({
  searchParams,
}: {
  searchParams?: { purpose?: string };
}) {
  redirect(
    searchParams?.purpose === "field_test"
      ? "/instructor/organize/field-test"
      : "/instructor/organize/quick",
  );
}
