import { auth } from "@/lib/auth";
import ExitImpersonationButton from "./ExitImpersonationButton";

export default async function ImpersonationBanner() {
  const session = await auth();
  const imp = session?.user?.impersonator;
  if (!imp) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-warning-200 bg-warning-50 text-warning-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <span className="font-semibold">Đang xem dưới vai trò</span>
        <span className="font-mono text-xs">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <span className="text-xs text-warning-800">
          (admin: {imp.name ?? imp.email}) — read-only view, audit log vẫn ghi
          dưới tên admin
        </span>
        <ExitImpersonationButton />
      </div>
    </div>
  );
}
