import type { CSSProperties, ReactNode } from "react";
import { parseInline } from "@/lib/limioLiveSlides";

/** Vẽ chữ có **in đậm**, *in nghiêng* và ==tô màu== (chỉ ba định dạng này, xem parseInline). */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text ?? "").map((r, i) => {
        let node: ReactNode = r.text;
        if (r.italic) node = <em key={`e${i}`}>{node}</em>;
        if (r.bold) node = <strong key={`b${i}`}>{node}</strong>;
        if (r.mark) node = <mark key={`m${i}`} className="ll-mark">{node}</mark>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/** Thứ tự hiện dần của một phần tử khi chiếu (biến --i của hiệu ứng .a / .a-pop). */
export const delay = (i: number): CSSProperties => ({ ["--i" as string]: i }) as CSSProperties;
