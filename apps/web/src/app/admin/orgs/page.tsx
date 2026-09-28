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
          Tìm trường/tổ chức, xem và cấp quyền OrgAdmin cho user.
        </p>
      </header>
      <OrgsBrowser />
    </main>
  );
}
