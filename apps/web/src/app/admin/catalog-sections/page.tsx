import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, listCatalogSectionsForAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import CatalogSectionsManager from "./CatalogSectionsManager";

export const dynamic = "force-dynamic";

export default async function CatalogSectionsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/catalog-sections");
  if (!(await isAdmin(session.user.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ admin mới quản lý được catalog section.
        </div>
      </main>
    );
  }

  const sections = await listCatalogSectionsForAdmin(session.user.id);

  return (
    <main>
      <Link href="/catalog" className="link inline-flex items-center gap-1 text-sm">
        ← Xem trang catalog
      </Link>

      <div className="mt-4">
        <span className="chip-brand">Admin · Catalog</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">Section catalog</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Nhóm khoá học hiển thị trên trang{" "}
          <Link href="/catalog" className="link">
            /catalog
          </Link>{" "}
          mặc định (khi chưa lọc/tìm kiếm). Section &quot;Tự động&quot; luôn lấy khoá học publish
          gần nhất, không cần chọn tay.
        </p>
      </div>

      <div className="mt-8">
        <CatalogSectionsManager initialSections={sections} />
      </div>
    </main>
  );
}
