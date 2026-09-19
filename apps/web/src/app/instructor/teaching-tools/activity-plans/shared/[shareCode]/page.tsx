import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SharedPlanView from "./SharedPlanView";

export const metadata = {
  title: "Kịch bản được chia sẻ | FeedBackMe",
};

export default async function SharedActivityPlanPage({
  params,
}: {
  params: { shareCode: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <SharedPlanView shareCode={params.shareCode} />
    </main>
  );
}
