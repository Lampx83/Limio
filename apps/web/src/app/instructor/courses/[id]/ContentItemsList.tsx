import ContentItemRow from "./ContentItemRow";
import EmptyState from "./EmptyState";

interface Item {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
}

export default function ContentItemsList({
  items,
  lessonId,
}: {
  items: Item[];
  lessonId: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="📄"
        title="Chưa có nội dung"
        description="Thêm video, markdown, file, PDF, SCORM, H5P, hay LTI để bắt đầu."
        cta={{
          label: "+ Thêm nội dung",
          eventName: "lesson-add:open",
          eventDetail: { mode: "content" },
        }}
      />
    );
  }
  return (
    <ol className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <ContentItemRow item={item} lessonId={lessonId} />
        </li>
      ))}
    </ol>
  );
}
