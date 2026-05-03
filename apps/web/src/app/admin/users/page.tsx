import UsersBrowser from "./UsersBrowser";

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <main>
      <header className="mb-6">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">
          👥 Quản lý người dùng
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tìm kiếm, phân quyền role, hoặc xem ứng dụng dưới vai trò của một người
          dùng.
        </p>
      </header>
      <UsersBrowser />
    </main>
  );
}
