/**
 * Làm sạch chữ do LLM sinh để hiện trong ô nhận xét dạng chữ thường (textarea, trang học viên).
 *
 * Qwen (vLLM) hay trả markdown dù prompt không xin: `**đậm**`, `### tiêu đề`, `` `code` ``, gạch đầu dòng
 * `- `/`* `, link `[chữ](url)`, đôi khi cả `\n` literal hoặc khối `<think>`. Những chỗ hiển thị đó không
 * render markdown nên học viên thấy nguyên ký hiệu. Hàm thuần, giữ xuống dòng/đoạn, chỉ bỏ cú pháp.
 */
export function toPlainText(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);

  // Khối suy luận lọt ra khi server không tắt thinking.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "");

  // Model đôi khi double-escape: "\\n" literal thay cho xuống dòng thật.
  s = s.replace(/\\r\\n|\\n/g, "\n").replace(/\\t/g, " ");

  // Hàng rào code ```lang … ``` → giữ nội dung bên trong.
  s = s.replace(/```[^\n`]*\n?([\s\S]*?)```/g, "$1");

  s = s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // ảnh
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1") // link
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // tiêu đề
    .replace(/^\s{0,3}>\s?/gm, "") // trích dẫn
    .replace(/^\s*[-*+]\s+/gm, "• ") // gạch đầu dòng
    .replace(/^\s*[-*_]{3,}\s*$/gm, "") // đường kẻ ngang
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // đậm
    .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])/g, "$1") // nghiêng *x*
    .replace(/~~(.+?)~~/g, "$1") // gạch ngang
    .replace(/`([^`\n]+)`/g, "$1"); // code nội dòng

  // Dấu còn sót (** lẻ, ` lẻ) do model cắt ngang hoặc lồng sai.
  s = s.replace(/\*\*|__|`/g, "");

  return s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
