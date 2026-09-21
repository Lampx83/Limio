/**
 * Checklist "đợt thi đã sẵn sàng chưa". Trước đây trang đợt thi chỉ có "Thông tin
 * chung / Đổi trạng thái / Vùng nguy hiểm" — giảng viên không biết còn thiếu gì,
 * và cảnh báo sẵn sàng chỉ hiện sâu trong từng ca. Hàm thuần để kiểm thử được.
 */

export interface ReadinessSession {
  id: string;
  /** Tên hiển thị của ca (mã hoặc tiêu đề). */
  label: string;
  examTitle: string;
  examStatus: string;
  /** authenticated ("Chưa chọn") | open_code | assigned_code */
  accessMode: string;
  roomCount: number;
}

export type ReadinessStatus = "ok" | "todo" | "info" | "skipped";

export interface ReadinessItem {
  key: "sessions" | "exams-published" | "rooms" | "access-mode";
  label: string;
  status: ReadinessStatus;
  /** Những ca/đề cụ thể còn vướng. */
  problems?: string[];
  /** Tab của đợt thi nơi xử lý mục này. */
  tab?: "sessions" | "cohorts" | "overview";
}

export function computeRoundReadiness(sessions: ReadinessSession[]): ReadinessItem[] {
  if (sessions.length === 0) {
    const skipped = (key: ReadinessItem["key"], label: string): ReadinessItem => ({
      key,
      label,
      status: "skipped",
    });
    return [
      {
        key: "sessions",
        label: "Tạo ít nhất một ca thi",
        status: "todo",
        problems: ["Đợt chưa có ca thi nào."],
        tab: "sessions",
      },
      skipped("exams-published", "Mọi ca dùng đề đã publish"),
      skipped("rooms", "Ca phát mã theo phòng đã có phòng"),
      skipped("access-mode", "Đã chọn cách vào thi cho từng ca"),
    ];
  }

  const unpublished = sessions.filter((s) => s.examStatus !== "published");
  const noRoom = sessions.filter((s) => s.accessMode === "assigned_code" && s.roomCount === 0);
  const unset = sessions.filter((s) => s.accessMode === "authenticated");

  return [
    { key: "sessions", label: "Tạo ít nhất một ca thi", status: "ok" },
    {
      key: "exams-published",
      label: "Mọi ca dùng đề đã publish",
      status: unpublished.length === 0 ? "ok" : "todo",
      problems: unpublished.map((s) => `${s.label} — đề "${s.examTitle}" chưa publish`),
      tab: "sessions",
    },
    {
      key: "rooms",
      label: "Ca phát mã theo phòng đã có phòng",
      status: noRoom.length === 0 ? "ok" : "todo",
      problems: noRoom.map((s) => `${s.label} chưa có phòng nào`),
      tab: "sessions",
    },
    {
      key: "access-mode",
      label: "Đã chọn cách vào thi cho từng ca",
      // Chỉ là lưu ý: "Chưa chọn" vẫn cho học viên đã ghi danh vào thi qua trang khoá học.
      status: unset.length === 0 ? "ok" : "info",
      problems: unset.map(
        (s) =>
          `${s.label} đang để "Chưa chọn" — chỉ học viên đã ghi danh khoá học vào được; chọn "mã tự do" hoặc "mã theo phòng" nếu cần phát mã`,
      ),
      tab: "sessions",
    },
  ];
}
