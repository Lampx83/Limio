import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import { instructorNav } from "@/lib/instructor-nav";
import NewModuleForm from "./new-module-form";
import ModuleEditor from "./module-editor";
import AnnouncementsSection, { type Announcement } from "./announcements-section";

interface CourseRow {
  id: number;
  code: string;
  title: string;
  description: string;
  owner_instructor_id: number;
}
interface ModuleRow {
  id: number;
  title: string;
  description: string | null;
  order_idx: number;
}
interface MatRow {
  id: number;
  module_id: number;
  type: "video" | "pdf" | "quiz";
  title: string;
  description: string | null;
  duration_min: number | null;
  order_idx: number;
  video_url: string | null;
  pdf_url: string | null;
  reading_text: string | null;
  quiz_data: string | null;
}
interface AsgRow {
  id: number;
  module_id: number;
  title: string;
  prompt: string;
  learning_objectives: string;
  rubric: string;
  min_words: number;
  order_idx: number;
}

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) notFound();

  const user = (await getCurrentUser())!;
  const course = db
    .prepare(
      "SELECT id, code, title, description, owner_instructor_id FROM courses WHERE id = ?",
    )
    .get(cid) as CourseRow | undefined;
  if (!course) notFound();
  if (course.owner_instructor_id !== user.id) notFound();

  const modules = db
    .prepare(
      "SELECT id, title, description, order_idx FROM modules WHERE course_id = ? ORDER BY order_idx",
    )
    .all(cid) as ModuleRow[];

  const materials = db
    .prepare(
      `SELECT id, module_id, type, title, description, duration_min, order_idx,
              video_url, pdf_url, reading_text, quiz_data
       FROM learning_materials WHERE module_id IN (${modules.map(() => "?").join(",") || "0"})
       ORDER BY module_id, order_idx`,
    )
    .all(...modules.map((m) => m.id)) as MatRow[];

  const assignments = db
    .prepare(
      `SELECT id, module_id, title, prompt, learning_objectives, rubric, min_words, order_idx
       FROM assignments WHERE module_id IN (${modules.map(() => "?").join(",") || "0"})
       ORDER BY module_id, order_idx`,
    )
    .all(...modules.map((m) => m.id)) as AsgRow[];

  const announcements = db
    .prepare(
      "SELECT id, title, body, pinned, created_at FROM announcements WHERE course_id = ? ORDER BY pinned DESC, created_at DESC",
    )
    .all(cid) as Announcement[];

  return (
    <AdminShell
      title={course.title}
      fullName={user.full_name}
      role="instructor"
      nav={instructorNav("courses")}
    >
      <Link
        href="/instructor/courses"
        className="text-sm text-brand-600 hover:underline"
      >
        ← Quay lại danh sách khoá học
      </Link>
      <div className="mt-3 mb-5">
        <p className="text-xs font-mono text-slate-500">{course.code}</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-1">{course.title}</h1>
        {course.description && (
          <p className="text-slate-600 mt-1">{course.description}</p>
        )}
      </div>

      <AnnouncementsSection courseId={cid} items={announcements} />

      <NewModuleForm courseId={cid} nextOrder={(modules.at(-1)?.order_idx ?? 0) + 1} />

      <h2 className="text-lg font-semibold mt-6 mb-3">
        Module ({modules.length})
      </h2>
      <ul className="space-y-3">
        {modules.length === 0 && (
          <li className="card p-6 text-center text-slate-500">
            Chưa có module. Tạo module đầu tiên ở trên.
          </li>
        )}
        {modules.map((m) => (
          <ModuleEditor
            key={m.id}
            module={m}
            materials={materials.filter((x) => x.module_id === m.id)}
            assignments={assignments.filter((x) => x.module_id === m.id)}
          />
        ))}
      </ul>
    </AdminShell>
  );
}
