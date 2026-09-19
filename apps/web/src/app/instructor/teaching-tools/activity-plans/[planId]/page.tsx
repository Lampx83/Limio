import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import ActivityPlanEditor from "./ActivityPlanEditor";

export const metadata = {
  title: "Sửa kịch bản | FeedBackMe",
};

export default async function ActivityPlanEditorPage({
  params,
}: {
  params: { planId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <main className="space-y-6">
      <Link
        href="/instructor/teaching-tools/activity-plans"
        className="inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        ← Kịch bản lớp học
      </Link>
      <ActivityPlanEditor planId={params.planId} />
    </main>
  );
}
