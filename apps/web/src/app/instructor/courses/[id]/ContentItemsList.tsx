import ContentItemRow from "./ContentItemRow";

interface Item {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
}

export default function ContentItemsList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] px-3 py-3 text-center text-sm text-muted">
        Chưa có content nào — thêm video, markdown, file, SCORM, H5P, LTI...
      </p>
    );
  }
  return (
    <ol className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <ContentItemRow item={item} />
        </li>
      ))}
    </ol>
  );
}
