import CoursesBrowser from "./CoursesBrowser";

export const dynamic = "force-dynamic";

export default function AdminCoursesPage() {
  return (
    <main>
      <header className="mb-6">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">Quản lý khoá học</h1>
        <p className="mt-1 text-sm text-muted">
          Tìm khoá học để quản lý gói bán theo thời hạn (1 năm, 2 năm, vĩnh viễn).
        </p>
      </header>
      <CoursesBrowser />
    </main>
  );
}
