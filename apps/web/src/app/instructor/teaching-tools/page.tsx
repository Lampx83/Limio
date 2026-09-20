import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";
import TeachingToolsClient from "./TeachingToolsClient";

export const dynamic = "force-dynamic";

interface Course {
  id: string;
  title: string;
  _count: { enrollments: number };
}

export default async function TeachingToolsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  // Fetch instructor's courses for Random Picker / Grouping Tool dropdowns
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
  }) as Course[];

  return (
    <main>
      {/* Trang mở công cụ dùng ngay tại lớp, khác "Bài giảng tương tác" (soạn sẵn rồi trình chiếu). */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Hoạt động nhanh</h1>
        <p className="mt-1 text-sm text-faint">
          Các phiên hoạt động nhanh ngay trên lớp để lấy ý kiến và tương tác với người học.
        </p>
      </header>

      <TeachingToolsClient courses={courses} />
    </main>
  );
}
