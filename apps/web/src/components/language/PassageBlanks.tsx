"use client";

import type { BlankNode } from "@/lib/passageBlanks";

/**
 * Đoạn hội thoại có chỗ trống: mỗi chỗ trống là một ô gõ ngay trong dòng thoại. Mọi chữ là text node (React tự thoát HTML); ảnh chỉ nhận đường dẫn nội bộ (đã kiểm ở parsePassageBlanks).
 */
export default function PassageBlanks({
  nodes,
  values,
  onChange,
  imageUrl,
}: {
  nodes: BlankNode[];
  values: string[];
  onChange: (index: number, value: string) => void;
  imageUrl: (src: string) => string;
}) {
  return (
    <div data-testid="passage-blanks">
      {nodes.map((n, i) =>
        n.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={imageUrl(n.src)} alt={n.alt} className="mx-auto mb-3 max-h-72 rounded-lg" />
        ) : (
          <p key={i} className="han-text mb-1 text-lg leading-10" lang="zh-Hans">
            {n.parts.map((p, k) =>
              "blank" in p ? (
                <input
                  key={k}
                  type="text"
                  value={values[p.blank] ?? ""}
                  onChange={(e) => onChange(p.blank, e.target.value)}
                  aria-label={`Chỗ trống ${p.blank + 1}`}
                  autoComplete="off"
                  spellCheck={false}
                  size={Math.max(6, (values[p.blank]?.length ?? 0) + 2)}
                  className="exam-inline-blank"
                />
              ) : (
                <span key={k}>{p.text}</span>
              ),
            )}
          </p>
        ),
      )}
    </div>
  );
}
