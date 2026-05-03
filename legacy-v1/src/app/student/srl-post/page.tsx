import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import SRLForm from "./srl-form";
import { SRL_QUESTIONS } from "@/lib/srl-questions";

export default async function SrlPostPage() {
  const user = (await getCurrentUser())!;

  const post = db
    .prepare("SELECT 1 FROM srl_responses WHERE user_id = ? AND phase='post'")
    .get(user.id);
  if (post) redirect("/student");

  return (
    <div className="min-h-screen">
      <Header
        title="Bảng hỏi SRL hậu thực nghiệm"
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
        <div className="card p-5 sm:p-6">
          <h1 className="text-xl font-bold mb-2">
            Bảng hỏi SRL sau khoá học
          </h1>
          <p className="text-sm text-slate-500 mb-5">
            Đánh giá lại mức độ tự điều chỉnh học tập của bạn TẠI THỜI ĐIỂM HIỆN TẠI
            (sau khi đã trải qua khoá học). 1 = rất không đồng ý, 5 = rất đồng ý.
          </p>
          <SRLForm questions={SRL_QUESTIONS} />
        </div>
      </main>
    </div>
  );
}
