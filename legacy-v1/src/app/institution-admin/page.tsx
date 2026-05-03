import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { StatCard } from "@/components/AdminShell";
import { institutionAdminNav } from "@/lib/instructor-nav";

interface InstRow {
  name: string;
  code: string;
}

export default async function InstitutionAdminOverview() {
  const user = (await getCurrentUser())!;
  const inst = db
    .prepare("SELECT name, code FROM institutions WHERE id = ?")
    .get(user.institution_id!) as InstRow;

  const stats = {
    instructors: (db.prepare("SELECT COUNT(*) AS n FROM users WHERE institution_id = ? AND role = 'instructor'").get(user.institution_id) as { n: number }).n,
    students: (db.prepare("SELECT COUNT(*) AS n FROM users WHERE institution_id = ? AND role = 'student'").get(user.institution_id) as { n: number }).n,
    courses: (db.prepare("SELECT COUNT(*) AS n FROM courses WHERE institution_id = ?").get(user.institution_id) as { n: number }).n,
    submissions: (db.prepare(`SELECT COUNT(*) AS n FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN modules m ON m.id = a.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE c.institution_id = ?`).get(user.institution_id) as { n: number }).n,
    feedbacks: (db.prepare(`SELECT COUNT(*) AS n FROM ai_feedbacks f
      JOIN submissions s ON s.id = f.submission_id
      JOIN assignments a ON a.id = s.assignment_id
      JOIN modules m ON m.id = a.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE c.institution_id = ?`).get(user.institution_id) as { n: number }).n,
    materials: (db.prepare(`SELECT COUNT(*) AS n FROM learning_materials lm
      JOIN modules m ON m.id = lm.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE c.institution_id = ?`).get(user.institution_id) as { n: number }).n,
  };

  // Tỉ lệ control vs personalized
  const condRows = db
    .prepare(
      "SELECT experiment_condition AS c, COUNT(*) AS n FROM users WHERE institution_id = ? AND role = 'student' GROUP BY experiment_condition",
    )
    .all(user.institution_id) as Array<{ c: string | null; n: number }>;
  const ctrl = condRows.find((x) => x.c === "control")?.n ?? 0;
  const pers = condRows.find((x) => x.c === "personalized")?.n ?? 0;

  return (
    <AdminShell
      title={`Quản trị: ${inst.name}`}
      fullName={user.full_name}
      role="institution_admin"
      badge={inst.code}
      nav={institutionAdminNav("overview")}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="Giảng viên" value={stats.instructors} />
        <StatCard label="Sinh viên" value={stats.students} hint={`Control ${ctrl} · Cá nhân hoá ${pers}`} />
        <StatCard label="Khoá học" value={stats.courses} />
        <StatCard label="Học liệu" value={stats.materials} />
        <StatCard label="Bài nộp" value={stats.submissions} />
        <StatCard label="AI feedback" value={stats.feedbacks} />
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="font-semibold mb-2">Cơ sở giáo dục</h3>
        <dl className="text-sm grid sm:grid-cols-2 gap-2">
          <Item label="Mã" value={inst.code} mono />
          <Item label="Tên đầy đủ" value={inst.name} />
        </dl>
      </div>
    </AdminShell>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-slate-700 dark:text-slate-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
