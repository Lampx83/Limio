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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="h-display text-display">Công cụ Giảng dạy</h1>
        <p className="mt-2 text-muted">
          Sử dụng các công cụ để tương tác với lớp học. Học viên quét mã QR để tham gia.
          Mỗi công cụ là một chức năng độc lập — chọn nguồn sinh viên ngay sau khi mở công cụ.
        </p>
      </header>

      <TeachingToolsClient courses={courses} />
    </main>
  );
}
