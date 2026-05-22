import { listSkillsWithStats } from "@feedbackme/core-lms";
import SkillsManager from "./SkillsManager";

export const revalidate = 30;

export default async function AdminSkillsPage() {
  const skills = await listSkillsWithStats();
  return (
    <main>
      <header className="mb-6">
        <h1 className="h-display text-3xl font-bold">Skill taxonomy</h1>
        <p className="mt-1 text-sm text-muted">
          Quản lý catalog skill và DAG prerequisite. Code là định danh duy nhất
          và không sửa được sau khi tạo.
        </p>
      </header>
      <SkillsManager initialSkills={skills} />
    </main>
  );
}
