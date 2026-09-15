import SafeHtml from "@/components/SafeHtml";
import OralAiAvatar, { type OralAvatarState } from "./OralAiAvatar";

/**
 * A6.6 (UI) — panel bên phải phòng vấn đáp: avatar AI + hướng dẫn/thông báo
 * do GV soạn (richtext, có thể chèn ảnh — xem Exam.description, gộp chung
 * với mô tả đề chứ không tách field riêng nữa). Ẩn dưới `lg` để dồn chỗ cho
 * khung chat trên màn hình nhỏ — avatar/hướng dẫn là nội dung hỗ trợ, không
 * phải luồng thao tác chính.
 */
export default function OralRoomSidePanel({
  avatarState,
  instructionsHtml,
}: {
  avatarState: OralAvatarState;
  instructionsHtml: string | null;
}) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-token bg-[rgb(var(--surface))] p-5 lg:flex">
      <div className="flex justify-center border-b border-token pb-5">
        <OralAiAvatar state={avatarState} />
      </div>
      <div className="mt-5">
        {instructionsHtml ? (
          <SafeHtml
            html={instructionsHtml}
            className="prose prose-sm max-w-none dark:prose-invert"
          />
        ) : (
          <p className="text-sm text-faint">
            Trả lời từng câu hỏi của AI giám khảo bằng lời lẽ tự nhiên, như
            đang trình bày trước giảng viên thật. AI sẽ đào sâu theo câu trả
            lời của bạn — không có đáp án đúng/sai cố định cho từng câu.
          </p>
        )}
      </div>
    </aside>
  );
}
