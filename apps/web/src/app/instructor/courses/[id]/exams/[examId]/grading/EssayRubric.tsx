import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";

/** Rubric GV đã soạn cho câu tự luận (config.rubric); rỗng nếu không có. */
export function essayRubricOf(type: string, config: unknown): string {
  if (type !== "essay") return "";
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const r = (config as { rubric?: unknown }).rubric;
    if (typeof r === "string") return r.trim();
  }
  return "";
}

/** Khối thu gọn "Rubric chấm" đặt ngay trên bài làm, để người chấm đối chiếu. */
export default function EssayRubric({ rubric }: { rubric: string }) {
  if (!rubric) return null;
  return (
    <details className="mb-3 rounded border border-default px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Rubric chấm</summary>
      <SafeHtml
        html={plainToRichHtml(rubric)}
        className="prose prose-sm mt-2 max-w-none dark:prose-invert"
      />
    </details>
  );
}
