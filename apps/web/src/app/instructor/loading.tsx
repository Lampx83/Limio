// Khung chờ cho mọi trang giảng viên. Hai điều để chuyển trang không bị giật:
//  - Hiện sau 150ms: trang nào tải nhanh thì không bao giờ thấy khung chớp lên rồi biến mất.
//  - Không có đệm riêng: khung nội dung (InstructorContentFrame) đã đệm sẵn, đệm thêm ở đây làm nội dung thật nhảy khi thay vào.
export default function InstructorLoading() {
  return (
    <div className="animate-overlay-in space-y-4 motion-reduce:animate-none [animation-delay:150ms]" aria-hidden>
      <div className="h-8 w-72 animate-pulse rounded-lg bg-base-100" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-base-100" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-token bg-base-100" />
        ))}
      </div>
    </div>
  );
}
