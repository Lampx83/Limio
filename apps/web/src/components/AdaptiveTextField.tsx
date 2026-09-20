"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { htmlToPlainText, looksLikeHtml, plainToRichHtml } from "@/lib/richText";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

/**
 * Có thẻ HTML nào ngoài <p>/<br> không. Tiptap luôn bọc chữ thường trong <p>,
 * nên một câu hỏi soạn ở chế độ rich mà chỉ có chữ vẫn mở được ở chế độ thường
 * mà không mất gì. Có ảnh, in đậm, danh sách… thì phải mở bằng rich.
 */
function needsRich(value: string): boolean {
  return /<(?!\/?(?:p|br)\b)[a-z][^>]*>/i.test(value);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Chữ thường lưu nguyên. Riêng khi GV gõ ra thứ trông như thẻ HTML ("x <b y")
 * thì thoát ký tự, vì bộ hiển thị (SafeHtml/plainToRichHtml) nhận dạng HTML
 * bằng đúng regex đó và sẽ coi cả chuỗi là HTML.
 */
function encodePlain(text: string): string {
  if (!looksLikeHtml(text)) return text;
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Ô nhập mặc định là văn bản thường; ai cần in đậm, danh sách, ảnh… thì bấm
 * chuyển sang trình soạn rich. Giá trị lưu vẫn cùng định dạng cũ (chuỗi chữ
 * hoặc HTML) nên không cần migration — nội dung đã có định dạng tự mở ở chế độ rich.
 */
export default function AdaptiveTextField({
  value,
  onChange,
  placeholder,
  minHeight = 80,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [rich, setRich] = useState(() => needsRich(value));
  const [text, setText] = useState(() => htmlToPlainText(value));

  // Cha đổi giá trị từ ngoài (vd. reset form sau khi tạo câu) → đồng bộ lại ô thường.
  useEffect(() => {
    if (rich) return;
    const derived = htmlToPlainText(value);
    if (derived.trim() !== text.trim()) setText(derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rich]);

  function toRich() {
    onChange(plainToRichHtml(text));
    setRich(true);
  }

  function toPlain() {
    if (
      needsRich(value) &&
      !confirm("Chuyển sang văn bản thường sẽ bỏ định dạng và ảnh trong ô này. Tiếp tục?")
    ) {
      return;
    }
    const plain = htmlToPlainText(value);
    setText(plain);
    onChange(encodePlain(plain));
    setRich(false);
  }

  const rows = Math.max(minHeight >= 80 ? 3 : 2, text.split("\n").length);

  return (
    <div>
      {rich ? (
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={minHeight}
        />
      ) : (
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(encodePlain(e.target.value));
          }}
          rows={rows}
          placeholder={placeholder}
          className="textarea w-full"
        />
      )}
      <div className="mt-1 text-right">
        <button
          type="button"
          onClick={rich ? toPlain : toRich}
          className="link text-xs"
          title={
            rich
              ? "Quay về ô nhập chữ thường"
              : "In đậm, danh sách, công thức, chèn ảnh…"
          }
        >
          {rich ? "Về văn bản thường" : "Định dạng / chèn ảnh"}
        </button>
      </div>
    </div>
  );
}
