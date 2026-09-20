import { ImageIcon, PenLine, type LucideIcon } from "lucide-react";
import { RESOURCE_TYPE_ICONS } from "./ResourceEditor";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "./ResourceContent";

// Không còn khái niệm "slide nội dung" với người dùng: mỗi slide là 1 trong 9 loại theo
// tài nguyên (Tiêu đề & ý chính, Văn bản, Markdown, Video, PDF, File, Link, Embed, HTML)
// hoặc 1 loại tương tác. Trong DB vẫn là type "content" — hàm này suy ra loại hiển thị.
export function contentKind(config: Record<string, any> | undefined): { label: string; icon: LucideIcon } {
  const c = config ?? {};
  const rt = (c.resource?.type ?? c.resourceKind) as ResourceType | undefined;
  if (rt && RESOURCE_TYPE_LABELS[rt]) return { label: RESOURCE_TYPE_LABELS[rt], icon: RESOURCE_TYPE_ICONS[rt] };
  if (!c.title && !c.subtitle && !c.bullets?.length && c.imageUrl) return { label: "Trang PDF", icon: ImageIcon };
  return { label: "Văn bản", icon: PenLine };
}
