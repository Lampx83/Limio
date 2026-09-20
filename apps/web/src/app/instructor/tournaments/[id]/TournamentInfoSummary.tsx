import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import { formatDateTime } from "@/lib/datetime";

export type InfoSummaryData = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  prizeXp: number;
  allowLateRegistration: boolean;
  showcaseMode: string;
  teamSize: number;
  courseTitle: string | null;
};

// Tab "Thông tin cơ bản": luôn hiện thông tin đang có (trước đây chỉ có một đường link "Sửa"
// nên tab trông như trống). Phần sửa nằm dưới, do TournamentMetaForm đảm nhiệm.
export default function TournamentInfoSummary({ data, note }: { data: InfoSummaryData; note?: string }) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
  return (
    <div className="card">
      <h3 className="text-base font-semibold">Thông tin đấu trường</h3>
      {note && <p className="mt-2 rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm text-muted">{note}</p>}
      <dl className="mt-2 divide-y divide-[rgb(var(--border))]">
        {row("Tiêu đề", <span className="font-medium">{data.title}</span>)}
        {row(
          "Mô tả",
          data.description.trim() ? (
            <SafeHtml html={plainToRichHtml(data.description)} className="prose prose-sm max-w-none" />
          ) : (
            <span className="text-muted">Chưa có mô tả</span>
          ),
        )}
        {row("Phạm vi", data.courseTitle ?? "Toàn hệ thống")}
        {row("Bắt đầu", formatDateTime(data.startsAt))}
        {row("Kết thúc", formatDateTime(data.endsAt))}
        {row(
          "Hình thức",
          data.teamSize > 1 ? (
            <>
              Theo đội, tối đa {data.teamSize} người mỗi đội{" "}
              <span className="text-muted">(không đổi được sau khi công bố)</span>
            </>
          ) : (
            "Cá nhân"
          ),
        )}
        {data.teamSize > 1 &&
          row(
            "Xem bài của các đội",
            data.showcaseMode === "always"
              ? "Ngay khi có bài nộp"
              : "Sau khi giải kết thúc (trong lúc thi mỗi đội chỉ thấy bài của mình)",
          )}
        {row("XP thưởng", <>{data.prizeXp > 0 ? `${data.prizeXp.toLocaleString("vi-VN")} XP` : "Không có"} <span className="text-muted">(chỉnh ở tab Giải thưởng)</span></>)}
        {row(
          "Đăng ký khi giải đang diễn ra",
          data.allowLateRegistration ? "Cho phép, người chơi vào được đến lúc kết thúc" : "Không, khoá danh sách khi giải bắt đầu",
        )}
      </dl>
    </div>
  );
}
