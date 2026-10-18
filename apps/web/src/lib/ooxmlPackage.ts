// Gói OOXML (.pptx, .xlsx): đọc phần XML có bộ nhớ đệm, quan hệ (.rels) và byte của một phần.
// Dùng chung cho bộ đọc trình chiếu (pptxImport) và sổ Excel nhúng trong trình chiếu (xlsxLite).

import JSZip from "jszip";
import { attr, childrenNamed, parseXml, type XmlEl } from "./xmlLite";

export function dirOf(p: string) {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i + 1);
}

/** "../media/image1.png" tính từ "ppt/slides/" → "ppt/media/image1.png". */
export function resolvePath(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = (baseDir + target).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

export interface Rel {
  type: string;
  target: string;
  external: boolean;
}

export class Pkg {
  private xmlCache = new Map<string, XmlEl | null>();
  constructor(private zip: JSZip) {}

  static async open(bytes: Uint8Array): Promise<Pkg | null> {
    try {
      return new Pkg(await JSZip.loadAsync(bytes));
    } catch {
      return null;
    }
  }

  has(p: string) {
    return !!this.zip.file(p);
  }

  /** Phần XML; null nếu không có, hỏng, hoặc dài hơn `maxChars` (bảng tính khổng lồ không đáng đọc cho một slide). */
  async xml(p: string, maxChars = Infinity): Promise<XmlEl | null> {
    if (this.xmlCache.has(p)) return this.xmlCache.get(p)!;
    const f = this.zip.file(p);
    let el: XmlEl | null = null;
    if (f) {
      try {
        const s = await f.async("string");
        el = s.length <= maxChars ? parseXml(s) : null;
      } catch {
        el = null;
      }
    }
    this.xmlCache.set(p, el);
    return el;
  }

  async rels(part: string): Promise<Map<string, Rel>> {
    const relPath = `${dirOf(part)}_rels/${part.slice(dirOf(part).length)}.rels`;
    const root = await this.xml(relPath);
    const out = new Map<string, Rel>();
    for (const r of childrenNamed(root, "Relationship")) {
      const id = attr(r, "Id");
      const target = attr(r, "Target");
      if (!id || !target) continue;
      const external = attr(r, "TargetMode") === "External";
      out.set(id, { type: attr(r, "Type") ?? "", target: external ? target : resolvePath(dirOf(part), target), external });
    }
    return out;
  }

  async bytes(p: string): Promise<Uint8Array | null> {
    const f = this.zip.file(p);
    return f ? f.async("uint8array") : null;
  }
}
