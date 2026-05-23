/** Lightweight Tiptap doc ↔ plain text roundtrip. Round 2 ships text-only;
 *  rich content (image, formatting) lands in a later round. */

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}
interface TiptapNode {
  type: string;
  content?: unknown[];
  text?: string;
  attrs?: Record<string, unknown>;
}

/** Match a markdown image standalone on its own line:  `![alt](url)` */
const IMG_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
/** Audio token standalone on its own line:  `[[audio:url|alt]]` */
const AUDIO_RE = /^\[\[audio:([^|\]]+)\|([^\]]*)\]\]$/;
/** Video token standalone on its own line:  `[[video:url|alt]]` */
const VIDEO_RE = /^\[\[video:([^|\]]+)\|([^\]]*)\]\]$/;

export function plainTextToTiptap(text: string): TiptapDoc {
  const blocks = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (blocks.length === 0) return { type: "doc", content: [] };
  const nodes: TiptapNode[] = blocks.map((block) => {
    const img = block.match(IMG_RE);
    if (img) {
      return {
        type: "image",
        attrs: { alt: img[1] ?? "", src: img[2] ?? "" },
      };
    }
    const audio = block.match(AUDIO_RE);
    if (audio) {
      return {
        type: "audio",
        attrs: { src: audio[1] ?? "", alt: audio[2] ?? "" },
      };
    }
    const video = block.match(VIDEO_RE);
    if (video) {
      return {
        type: "video",
        attrs: { src: video[1] ?? "", alt: video[2] ?? "" },
      };
    }
    return {
      type: "paragraph",
      content: [{ type: "text", text: block }],
    };
  });
  return { type: "doc", content: nodes };
}

export function tiptapToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const d = doc as TiptapDoc;
  if (!Array.isArray(d.content)) return "";
  return d.content
    .map((node) => {
      if (node.type === "image") {
        const alt = (node.attrs?.alt as string) ?? "";
        const src = (node.attrs?.src as string) ?? "";
        return `![${alt}](${src})`;
      }
      if (node.type === "audio") {
        const alt = (node.attrs?.alt as string) ?? "";
        const src = (node.attrs?.src as string) ?? "";
        return `[[audio:${src}|${alt}]]`;
      }
      if (node.type === "video") {
        const alt = (node.attrs?.alt as string) ?? "";
        const src = (node.attrs?.src as string) ?? "";
        return `[[video:${src}|${alt}]]`;
      }
      if (node.type !== "paragraph") return "";
      const inline = node.content as TiptapNode[] | undefined;
      if (!inline) return "";
      return inline
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
    })
    .filter((s) => s.length > 0)
    .join("\n\n");
}
