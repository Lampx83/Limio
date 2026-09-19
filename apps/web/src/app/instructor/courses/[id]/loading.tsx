import { Skeleton } from "@/components/Skeleton";

// Khung xương của trang soạn khoá: giữ nguyên bố cục header + tab + khối nội
// dung, để chuyển bài/tab chỉ thay phần thân chứ không nháy sang skeleton của
// danh sách khoá (loading.tsx ở thư mục cha).
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-6" aria-busy="true">
      <Skeleton className="h-4 w-28" />
      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-6 w-20" rounded="rounded-full" />
      </div>
      <Skeleton className="mt-2 h-3 w-64" />
      <div className="mt-4 flex gap-2 border-b border-token pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" rounded="rounded-lg" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-9 w-64" rounded="rounded-lg" />
        <div className="space-y-2 rounded-2xl border border-token p-5">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-4 h-14 w-full" rounded="rounded-lg" />
          <Skeleton className="h-14 w-full" rounded="rounded-lg" />
          <Skeleton className="h-14 w-full" rounded="rounded-lg" />
        </div>
      </div>
    </main>
  );
}
