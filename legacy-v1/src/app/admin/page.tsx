import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { StatCard } from "@/components/AdminShell";
import { systemAdminNav } from "@/lib/instructor-nav";

export default async function SystemAdminOverview() {
  const user = (await getCurrentUser())!;
  const counts = {
    institutions: (db.prepare("SELECT COUNT(*) AS n FROM institutions").get() as { n: number }).n,
    instructors: (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'instructor'").get() as { n: number }).n,
    students: (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").get() as { n: number }).n,
    courses: (db.prepare("SELECT COUNT(*) AS n FROM courses").get() as { n: number }).n,
    submissions: (db.prepare("SELECT COUNT(*) AS n FROM submissions").get() as { n: number }).n,
    ai_fb: (db.prepare("SELECT COUNT(*) AS n FROM ai_feedbacks").get() as { n: number }).n,
    mat_fb: (db.prepare("SELECT COUNT(*) AS n FROM material_feedbacks").get() as { n: number }).n,
    materials: (db.prepare("SELECT COUNT(*) AS n FROM learning_materials").get() as { n: number }).n,
  };

  // per-institution breakdown
  const perInst = db
    .prepare(
      `SELECT i.name, i.code,
              (SELECT COUNT(*) FROM users WHERE institution_id = i.id AND role = 'student') AS n_students,
              (SELECT COUNT(*) FROM users WHERE institution_id = i.id AND role = 'instructor') AS n_instructors,
              (SELECT COUNT(*) FROM courses WHERE institution_id = i.id) AS n_courses
       FROM institutions i ORDER BY i.id`,
    )
    .all() as Array<{
    name: string;
    code: string;
    n_students: number;
    n_instructors: number;
    n_courses: number;
  }>;

  return (
    <AdminShell
      title="Tổng quan hệ thống"
      fullName={user.full_name}
      role="system_admin"
      nav={systemAdminNav("overview")}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Cơ sở giáo dục" value={counts.institutions} />
        <StatCard label="Giảng viên" value={counts.instructors} />
        <StatCard label="Sinh viên" value={counts.students} />
        <StatCard label="Khoá học" value={counts.courses} />
        <StatCard label="Học liệu" value={counts.materials} />
        <StatCard label="Bài nộp" value={counts.submissions} />
        <StatCard label="AI feedback bài tập" value={counts.ai_fb} />
        <StatCard label="AI feedback học liệu" value={counts.mat_fb} />
      </div>

      <h2 className="text-lg font-semibold mb-3">Theo cơ sở giáo dục</h2>
      <ul className="space-y-2">
        {perInst.map((i) => (
          <li key={i.code} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium">{i.name}</p>
              <p className="text-xs font-mono text-slate-500">{i.code}</p>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 flex flex-wrap gap-3">
              <span>{i.n_instructors} GV</span>
              <span>{i.n_students} SV</span>
              <span>{i.n_courses} khoá</span>
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
