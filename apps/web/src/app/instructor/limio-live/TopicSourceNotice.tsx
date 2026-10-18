import { Info } from "lucide-react";
import { isTopicSource, type DeckSourceKind } from "@/lib/limioLiveOutline";

/**
 * Lời nhắc của bài AI soạn từ mô tả chủ đề (không có tài liệu gốc), hiện ở trang dàn ý và trình sửa slide.
 * Không tắt được: nó ghi nhận nguồn gốc nội dung chứ không phải lỗi cần sửa. Không hiện trên màn chiếu.
 */
export function TopicSourceNotice({
  sourceKind,
  webRefs,
  compact = false,
}: {
  sourceKind: DeckSourceKind | null | undefined;
  /** null = không tìm nguồn internet; [] = có bật nhưng không tìm được trang nào. */
  webRefs?: unknown[] | null;
  compact?: boolean;
}) {
  if (!sourceKind || !isTopicSource(sourceKind)) return null;
  const pages = Array.isArray(webRefs) ? webRefs.length : 0;
  const head =
    sourceKind === "topic_web"
      ? `Nội dung do AI viết từ kiến thức chung và ${pages} trang tìm trên internet, thầy/cô cần kiểm tra trước khi dạy.`
      : "Nội dung do AI viết từ kiến thức chung, thầy/cô cần kiểm tra trước khi dạy.";
  const more =
    sourceKind === "topic_web"
      ? "Số liệu và trích dẫn có ghi nguồn ở chân slide; slide cuối liệt kê các trang đã đọc."
      : Array.isArray(webRefs)
        ? "Hệ thống không tìm được trang phù hợp trên internet nên bài chỉ dùng kiến thức chung, không có số liệu, trích dẫn hay tên người."
        : "Bài không có tài liệu gốc nên AI không đưa số liệu, trích dẫn hay tên người.";
  return (
    <p role="note" className={`banner-info ${compact ? "px-3 py-2 text-[13px]" : ""}`}>
      <Info size={compact ? 15 : 17} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        <b className="font-semibold">{head}</b>
        {!compact && <> {more}</>}
      </span>
    </p>
  );
}
