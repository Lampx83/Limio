import EnterCodeForm from "./EnterCodeForm";

export const metadata = {
  title: "Nhập mã thi",
  description: "Sinh viên nhập mã thi để bắt đầu làm bài",
};

// Landing page for proctor-led exam rooms. URL ngắn dễ nhớ: /thi
// Giám thị mở sẵn URL này trên các máy tính trong phòng; sinh viên chỉ cần
// gõ mã thi 6-8 ký tự rồi Enter để vào bài thi.
export default function ExamCodeLandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="text-center">
        <div className="text-5xl">📝</div>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Bắt đầu làm bài thi
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Nhập mã thi giám thị đã cấp cho bạn
        </p>
      </div>

      <div className="mt-8">
        <EnterCodeForm />
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Cần trợ giúp? Hỏi giám thị trong phòng.
      </p>
    </main>
  );
}
