import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import TeachingToolsClient from "./TeachingToolsClient";

export const dynamic = "force-dynamic";

export default async function TeachingToolsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  // Fetch instructor's courses
  const courses = await prisma.course.findMany({
    where: {
      instructors: {
        some: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      title: true,
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">Công cụ Giảng dạy</h1>
        <p className="mt-2 text-muted">
          Chọn một khóa học hoặc nhập danh sách sinh viên thủ công để sử dụng
          các công cụ
        </p>
      </header>

      <TeachingToolsClient courses={courses} />
    </main>
  );
}
