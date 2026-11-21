import { getActiveRole } from "@/lib/active-role";
import { auth } from "@/lib/auth";
import { hubEnabled, hubProject, hubUrl } from "@/lib/feedback-hub";
import FeedbackHubWidget from "./FeedbackHubWidget";

/**
 * Hộp góp ý Feedback Hub: một dòng `<FeedbackHub />` ở root layout. Không render gì khi hub chưa cấu hình hoặc
 * người dùng chưa đăng nhập. Xem docs/feedback-hub.md.
 */
export default async function FeedbackHub() {
  const user = hubEnabled() ? (await auth().catch(() => null))?.user : null;
  if (!user?.id) return null;
  return (
    <FeedbackHubWidget
      hub={hubUrl()}
      project={hubProject()}
      basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ""}
      role={getActiveRole(user.roles ?? [])}
    />
  );
}
