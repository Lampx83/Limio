import OrgsBrowser from "./OrgsBrowser";

export const dynamic = "force-dynamic";

export default function AdminOrgsPage() {
  return (
    <main>
      <header className="mb-6">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">
          Tổ chức (Organization)
        </h1>
        <p className="mt-1 text-sm text-muted">
          Chọn một tổ chức để cấu hình tên, logo, chữ ký, kỳ học và cấp quyền OrgAdmin.
        </p>
      </header>
      <OrgsBrowser />
    </main>
  );
}
