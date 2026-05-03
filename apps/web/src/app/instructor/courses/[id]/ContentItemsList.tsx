import ContentItemRow from "./ContentItemRow";

interface Item {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
}

export default function ContentItemsList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="mt-1 text-xs text-slate-500">Chưa có content nào.</p>;
  }
  return (
    <ol className="mt-1 space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <ContentItemRow item={item} />
        </li>
      ))}
    </ol>
  );
}
