// Tìm trang trên internet cho bài giảng soạn từ mô tả chủ đề (mức "topic_web").
// Mô hình chat tự host không tự lên mạng được, nên hệ thống tìm trước, đọc phần chữ, rồi đưa cho AI như một tài liệu
// có đánh số [n]. Dịch vụ tìm kiếm đi qua một adapter để đổi được; adapter đầu tiên là Tavily (trả sẵn chữ của trang,
// không phải tự tải HTML). Khoá lưu ở Quản trị > Tích hợp ("websearch.tavily") hoặc biến môi trường TAVILY_API_KEY.

import { hostOf, type WebSourceRef } from "./limioLiveOutline";

export interface WebPage {
  title: string;
  url: string;
  content: string;
}

export interface WebSearchProvider {
  id: string;
  /** Không ném lỗi: dịch vụ hỏng hoặc không có kết quả thì trả mảng rỗng (bài rơi về mức kiến thức chung). */
  search(query: string, maxResults: number): Promise<WebPage[]>;
}

/** Số trang tối đa đưa cho AI (cũng là số dòng tối đa của slide Nguồn tham khảo). */
export const WEB_MAX_PAGES = 5;
/** Chữ tối đa lấy từ mỗi trang: 5 trang cộng mô tả vẫn dưới mức tài liệu một lần gọi (24.000 ký tự). */
export const WEB_PAGE_CHARS = 3500;
/** Trang ít chữ hơn mức này thường là trang danh mục hoặc bị chặn: bỏ. */
const WEB_PAGE_MIN_CHARS = 200;
const QUERY_MAX = 380;
const TIMEOUT_MS = 20_000;

/** Câu tìm kiếm: chính đoạn mô tả, gọn khoảng trắng, cắt ở ranh giới từ cho vừa giới hạn của dịch vụ. */
export function searchQueryFromTopic(topic: string): string {
  const q = topic.replace(/\s+/g, " ").trim();
  if (q.length <= QUERY_MAX) return q;
  const cut = q.slice(0, QUERY_MAX);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).trim();
}

const urlKey = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}${x.search}`;
  } catch {
    return u;
  }
};

/** Chuẩn hoá kết quả: bỏ trùng địa chỉ, bỏ trang ít chữ, gọn khoảng trắng, cắt độ dài, đánh số 1..n. */
export function toSourcePages(pages: WebPage[], max = WEB_MAX_PAGES): Array<WebSourceRef & { content: string }> {
  const seen = new Set<string>();
  const out: Array<WebSourceRef & { content: string }> = [];
  for (const p of pages) {
    if (!/^https?:\/\//.test(p.url)) continue;
    const key = urlKey(p.url);
    if (seen.has(key)) continue;
    const content = p.content.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (content.length < WEB_PAGE_MIN_CHARS) continue;
    seen.add(key);
    out.push({
      n: out.length + 1,
      title: p.title.replace(/\s+/g, " ").trim().slice(0, 200) || hostOf(p.url),
      url: p.url.slice(0, 2000),
      content: content.slice(0, WEB_PAGE_CHARS),
    });
    if (out.length >= max) break;
  }
  return out;
}

export function tavilyProvider(apiKey: string, fetchImpl: typeof fetch = fetch, baseUrl = "https://api.tavily.com"): WebSearchProvider {
  return {
    id: "tavily",
    async search(query, maxResults) {
      try {
        const res = await fetchImpl(`${baseUrl}/search`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_raw_content: true, include_answer: false }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
          console.warn("[webSearch] tavily", res.status);
          return [];
        }
        const j = (await res.json()) as { results?: Array<{ title?: unknown; url?: unknown; content?: unknown; raw_content?: unknown }> };
        return (j.results ?? [])
          .map((r) => ({
            title: typeof r.title === "string" ? r.title : "",
            url: typeof r.url === "string" ? r.url : "",
            content: typeof r.raw_content === "string" && r.raw_content.trim() ? r.raw_content : typeof r.content === "string" ? r.content : "",
          }))
          .filter((r) => r.url && r.content);
      } catch (e) {
        console.warn("[webSearch] tavily", (e as Error).message);
        return [];
      }
    },
  };
}

/** Dịch vụ tìm kiếm đã cấu hình, hoặc null (khi đó giao diện không hiện công tắc nguồn internet). */
export async function getWebSearchProvider(): Promise<WebSearchProvider | null> {
  try {
    // Nạp muộn để phần thuần của module (chuẩn hoá trang, adapter) test được không cần cơ sở dữ liệu.
    const { getIntegrationSecret } = await import("@feedbackme/core-lms");
    const key = (await getIntegrationSecret("websearch.tavily")).trim();
    // TAVILY_BASE_URL chỉ dùng khi thử ở máy dev với dịch vụ giả.
    return key ? tavilyProvider(key, fetch, process.env.TAVILY_BASE_URL?.trim() || undefined) : null;
  } catch {
    return null;
  }
}
