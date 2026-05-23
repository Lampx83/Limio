import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import TemplateList from "../TimerTemplates/TemplateList";

export const metadata = {
  title: "Timer Templates | FeedBackMe",
  description: "Manage your countdown timer templates",
};

export default async function TimerTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-token pb-6">
        <div>
          <Link
            href="/instructor/teaching-tools"
            className="mb-2 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            ← Back to Teaching Tools
          </Link>
          <h1 className="text-3xl font-bold">Timer Templates</h1>
          <p className="mt-2 text-muted">
            Create and manage reusable countdown timer configurations
          </p>
        </div>
      </div>

      {/* Help Text */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-sm">
          📝 <strong>Tip:</strong> Create templates for common timer durations
          and instructions. When deploying activities, quickly select a template
          instead of manual setup.
        </p>
      </div>

      {/* Template List */}
      <TemplateList />
    </main>
  );
}
