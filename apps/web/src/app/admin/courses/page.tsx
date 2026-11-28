import { VIRTUAL_LECTURERS } from "@feedbackme/core-lms";
import CoursesBrowser from "./CoursesBrowser";
import AdminSectionTabs from "../_components/AdminSectionTabs";

export const dynamic = "force-dynamic";

export default function AdminCoursesPage() {
  return (
    <main>
      <AdminSectionTabs section="content" />
      <header className="mb-6">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">Quản lý khoá học</h1>
        <p className="mt-1 text-sm text-muted">
          Quản lý gói bán, tổ chức sở hữu, khoá mẫu và giảng viên ảo của từng khoá.
        </p>
      </header>
      <CoursesBrowser
        lecturers={VIRTUAL_LECTURERS.map((l) => ({
          code: l.code,
          name: l.name,
          gender: l.gender,
        }))}
      />
    </main>
  );
}
