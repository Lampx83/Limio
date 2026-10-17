import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { HeadingId } from "./headingId";
import { LESSON_NODES } from "./lessonNodes";

/**
 * Một danh sách duy nhất, dùng cho cả editor thật lẫn hàm dò mất mát. Tách ra
 * đây vì hai chỗ đó mà lệch nhau thì lời cảnh báo sẽ nói sai sự thật.
 */
export const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    // Thay bằng LessonDocument để tài liệu chứa được mục/hộp của bài học.
    document: false,
    // StarterKit v3 đã kèm Link/Underline — tắt để dùng bản cấu hình bên dưới,
    // không thì TipTap có hai extension trùng tên và cấu hình nào thắng là may rủi.
    link: false,
    underline: false,
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
  }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { class: "max-w-full h-auto rounded-md" },
  }),
  HeadingId,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  ...LESSON_NODES,
];
