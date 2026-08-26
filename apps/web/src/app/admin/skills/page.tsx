import Link from "next/link";
import { listSkillsWithStats } from "@feedbackme/core-lms";
import SkillsManager from "./SkillsManager";

export const revalidate = 30;

export default async function AdminSkillsPage({
  searchParams,
}: {
  searchParams: { auto?: string };
}) {
  // B1.5 — one auto tag exists per lesson; showing them by default would bury
  // the taxonomy an admin actually authored.
  const includeAuto = searchParams.auto === "1";
  const skills = await listSkillsWithStats({ includeAuto });

  return (
    <main>
      <header className="mb-6">
        <h1 className="h-display text-3xl font-bold">Skill taxonomy</h1>
        <p className="mt-1 text-sm text-muted">
          Quản lý catalog skill do người dùng tự tạo. Code là định danh duy nhất
          và không sửa được sau khi tạo.
        </p>
        <p className="mt-3 text-sm text-muted">
          {includeAuto ? (
            <>
              Đang hiện cả chủ đề tự sinh từ bài học.{" "}
              <Link href="/admin/skills" className="link">
                Chỉ hiện skill tự tạo
              </Link>
            </>
          ) : (
            <>
              Chủ đề tự sinh từ bài học (mã <code>lesson.*</code>) đang được ẩn.{" "}
              <Link href="/admin/skills?auto=1" className="link">
                Hiện tất cả
              </Link>
            </>
          )}
        </p>
      </header>
      <SkillsManager initialSkills={skills} />
    </main>
  );
}
